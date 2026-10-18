"""Account-scoped preferences; keys are memory-only unless explicitly retained.

Retained keys use Fernet with a local machine file. This is encryption at rest,
not protection against someone who can read the entire local runtime directory.
"""
import hashlib
import json
import os
import re
import shutil
import threading
from pathlib import Path
from urllib.parse import urlsplit
from cryptography.fernet import Fernet, InvalidToken
from .presets import AI, SEARCH, defaults, preset


def account_scope(user_id, token):
    if not re.fullmatch(r'[A-Za-z0-9:_-]{1,160}', user_id or '') or not re.fullmatch(r'[A-Za-z0-9_-]{40,160}', token or ''):
        raise ValueError('本地账户连接无效 / Invalid local account connection')
    return hashlib.sha256((user_id + ':' + token).encode()).hexdigest()


def validate_endpoint(url, provider):
    try:
        p = urlsplit(url)
        local = provider == 'ollama' and p.hostname in ('localhost', '127.0.0.1', '::1')
        if not p.hostname or p.username or p.password or p.query or p.fragment or '\\' in url or any(ord(c) < 32 for c in url):
            raise ValueError()
        if p.scheme != 'https' and not (local and p.scheme == 'http'):
            raise ValueError()
        if p.path.endswith(('/chat/completions', '/messages')):
            raise ValueError('AI Base URL 不应包含 /chat/completions 或 /messages')
        return url.rstrip('/')
    except (ValueError, TypeError):
        raise ValueError('请输入 HTTPS 服务地址；Ollama 可使用本机 HTTP 地址。AI Base URL 不要包含 /chat/completions。') from None


class SettingsStore:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.lock = threading.RLock()
        self.memory = {}
        key_path = self.root / 'master.key'
        if not key_path.exists():
            try:
                with key_path.open('xb') as f:
                    f.write(Fernet.generate_key())
                os.chmod(key_path, 0o600)
            except FileExistsError:
                pass
        self.cipher = Fernet(key_path.read_bytes())

    def directory(self, scope):
        if not re.fullmatch('[a-f0-9]{64}', scope):
            raise ValueError('Invalid account scope')
        path = self.root / 'accounts' / scope
        path.mkdir(parents=True, exist_ok=True, mode=0o700)
        return path

    def _load(self, scope):
        path = self.directory(scope) / 'settings.json'
        return json.loads(path.read_text('utf-8')) if path.exists() else {'active': {'ai': 'openai', 'search': 'tavily'}, 'ai': {}, 'search': {}}

    def _write(self, scope, data):
        path = self.directory(scope) / 'settings.json'
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')
        os.chmod(temp, 0o600)
        temp.replace(path)

    def _key(self, scope, kind, provider, config):
        if config.get('encrypted_key'):
            try:
                return self.cipher.decrypt(config['encrypted_key'].encode()).decode()
            except InvalidToken:
                return ''
        return self.memory.get((scope, kind, provider), '')

    def get_config(self, scope, kind, provider=None):
        with self.lock:
            data = self._load(scope)
            provider = provider or data['active'][kind]
            config = {**defaults(kind, provider), **data[kind].get(provider, {})}
            key = self._key(scope, kind, provider, config)
            config.pop('encrypted_key', None)
            return provider, config, key

    def public(self, scope):
        with self.lock:
            data = self._load(scope)
            result = {'active': data['active'], 'ai': {}, 'search': {}}
            for kind, choices in [('ai', AI), ('search', SEARCH)]:
                for p in choices:
                    _, config, key = self.get_config(scope, kind, p['id'])
                    result[kind][p['id']] = dict(config, has_key=bool(key), ready=bool(config['base_url'] and (key or p.get('key_optional')) and (kind != 'ai' or config.get('model'))))
            return result

    def save(self, scope, kind, provider, changes):
        with self.lock:
            p = preset(kind, provider)
            data = self._load(scope)
            _, old, old_key = self.get_config(scope, kind, provider)
            allowed = {'base_url', 'model', 'max_tokens', 'max_results', 'persist_key', 'api_key', 'clear_key', 'make_active'}
            if set(changes) - allowed:
                raise ValueError('配置包含未知字段 / Unknown setting')
            config = {**old, **{k: v for k, v in changes.items() if k in ('base_url', 'model', 'max_tokens', 'max_results', 'persist_key')}}
            config['base_url'] = validate_endpoint(config['base_url'], provider)
            for flag in ('persist_key', 'clear_key', 'make_active'):
                if flag in changes and not isinstance(changes[flag], bool):
                    raise ValueError(flag + ' 必须为布尔值')
            if kind == 'ai':
                if not isinstance(config['model'], str) or not 1 <= len(config['model'].strip()) <= 160:
                    raise ValueError('请填写模型 ID / Model ID is required')
                config['model'] = config['model'].strip()
                if type(config['max_tokens']) is not int or not 64 <= config['max_tokens'] <= 32768:
                    raise ValueError('Max tokens 需要在 64–32768 之间')
                config['protocol'] = p['protocol']
            elif type(config['max_results']) is not int or not 1 <= config['max_results'] <= 20:
                raise ValueError('搜索结果数需要在 1–20 之间')
            key = changes.get('api_key')
            if key is not None and (not isinstance(key, str) or len(key) > 4096 or any(c in key for c in '\r\n')):
                raise ValueError('API key 格式无效')
            key = (key or '').strip() or old_key
            if changes.get('clear_key'):
                key = ''
            # Never send an existing credential to a newly edited endpoint.
            if config['base_url'] != old['base_url'] and old_key and not (changes.get('api_key') or '').strip() and not changes.get('clear_key'):
                raise ValueError('服务地址已更改，请重新填写密钥以确认新的接收地址。')
            self.memory.pop((scope, kind, provider), None)
            if key and config['persist_key']:
                config['encrypted_key'] = self.cipher.encrypt(key.encode()).decode()
            elif key:
                self.memory[(scope, kind, provider)] = key
            data[kind][provider] = config
            if changes.get('make_active'):
                data['active'][kind] = provider
            self._write(scope, data)
            return self.public(scope)

    def clear_key(self, scope, kind, provider):
        with self.lock:
            preset(kind, provider)
            data = self._load(scope)
            data[kind].get(provider, {}).pop('encrypted_key', None)
            self.memory.pop((scope, kind, provider), None)
            self._write(scope, data)
            return self.public(scope)

    def delete(self, scope):
        with self.lock:
            for k in list(self.memory):
                if k[0] == scope:
                    del self.memory[k]
            shutil.rmtree(self.directory(scope), ignore_errors=True)
