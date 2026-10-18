"""Editable service presets. These are choices, never bundled credentials."""

AI = [
    dict(id='openai', name='OpenAI · GPT', protocol='openai', base_url='https://api.openai.com/v1', model='gpt-4.1-mini', models=['gpt-4.1-mini','gpt-4.1','gpt-5-mini'], docs='https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create'),
    dict(id='deepseek', name='DeepSeek', protocol='openai', base_url='https://api.deepseek.com', model='deepseek-flash', models=['deepseek-flash','deepseek-v4-pro'], docs='https://api-docs.deepseek.com/'),
    dict(id='anthropic', name='Anthropic · Claude', protocol='anthropic', base_url='https://api.anthropic.com/v1', model='claude-sonnet-4-6', models=['claude-sonnet-4-6','claude-sonnet-5'], docs='https://platform.claude.com/docs/en/api/messages/create'),
    dict(id='gemini', name='Google · Gemini', protocol='openai', base_url='https://generativelanguage.googleapis.com/v1beta/openai', model='gemini-3.8-flash', models=['gemini-3.8-flash'], docs='https://ai.google.dev/gemini-api/docs/openai'),
    dict(id='qwen', name='通义千问 · Qwen', protocol='openai', base_url='https://dashscope.aliyuncs.com/compatible-mode/v1', model='qwen-plus', models=['qwen-plus','qwen-turbo','qwen-max'], docs='https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope'),
    dict(id='moonshot', name='Moonshot · Kimi', protocol='openai', base_url='https://api.moonshot.cn/v1', model='kimi-k3', models=['kimi-k3','kimi-k2.6'], docs='https://platform.moonshot.cn/docs/overview'),
    dict(id='siliconflow', name='硅基流动 · SiliconFlow', protocol='openai', base_url='https://api.siliconflow.cn/v1', model='', models=[], docs='https://docs.siliconflow.cn/'),
    dict(id='ollama', name='Ollama · 本地模型', protocol='openai', base_url='http://127.0.0.1:11434/v1', model='', models=[], key_optional=True, docs='https://docs.ollama.com/api/openai-compatibility'),
    dict(id='custom', name='自定义 · OpenAI compatible', protocol='openai', base_url='', model='', models=[], docs=''),
]
SEARCH = [
    dict(id='openalex', name='OpenAlex · 学术搜索', base_url='https://api.openalex.org', docs='https://help.openalex.org/api/authentication/'),
    dict(id='tavily', name='Tavily', base_url='https://api.tavily.com/search', docs='https://docs.tavily.com/documentation/api-reference/endpoint/search'),
    dict(id='brave', name='Brave Search', base_url='https://api.search.brave.com/res/v1/web/search', docs='https://api-dashboard.search.brave.com/app/documentation/web-search/get-started'),
    dict(id='serper', name='Serper · Google', base_url='https://google.serper.dev/search', docs='https://serper.dev/'),
    dict(id='serpapi', name='SerpAPI · Google', base_url='https://serpapi.com/search.json', docs='https://serpapi.com/search-api'),
    dict(id='exa', name='Exa', base_url='https://api.exa.ai/search', docs='https://exa.ai/docs/reference/search'),
    dict(id='custom', name='自定义 · JSON Search', base_url='', docs=''),
]

def preset(kind, provider):
    choices = AI if kind == 'ai' else SEARCH if kind == 'search' else []
    found = next((dict(x) for x in choices if x['id'] == provider), None)
    if found is None:
        raise ValueError('未知服务商 / Unknown provider')
    return found

def defaults(kind, provider):
    p = preset(kind, provider)
    result = {'base_url': p['base_url'], 'persist_key': False}
    if kind == 'ai':
        result.update(model=p['model'], max_tokens=4096, protocol=p['protocol'])
    else:
        result.update(max_results=8)
    return result
