import { AppearanceControls } from '@/app/components/AppearanceControls';
import { translate as t } from '@/app/i18n';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Plus, LockKeyhole, ArrowUpRight, UserRound } from 'lucide-react';
import type { AvatarTone, LocalAccount } from '@/app/services/db';
import { Avatar, Brand } from '@/ui/components';
const tones: AvatarTone[] = ['mint', 'lavender', 'sunset', 'sky'];
export function Welcome({ accounts, onCreate, onSelect }: {
    accounts: LocalAccount[];
    onCreate: (nickname: string, tone: AvatarTone) => Promise<void>;
    onSelect: (id: string) => Promise<void>;
}) {
    const [nickname, setNickname] = useState('');
    const [tone, setTone] = useState<AvatarTone>('mint');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function select(id: string) {
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            await onSelect(id);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : t("无法切换档案"));
        }
        finally {
            setBusy(false);
        }
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!nickname.trim()) {
            setError(t("请输入一个称呼"));
            return;
        }
        setBusy(true);
        setError('');
        try {
            await onCreate(nickname, tone);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : t("创建失败"));
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="auth-scene">
    <div className="auth-side"><Link to="/" className="back-home"><ArrowLeft size={17}/>{t("返回首页")}</Link>
      <div className="auth-side-message"><span className="scene-flower">✳</span><p className="auth-side-eyebrow">RESEARCHSPACE</p><h2>{t("每一个科研故事，")}<br />{t("都始于一个想法。")}</h2><p>{t("创建一个属于你的探索空间。我们会先问你几个简单的问题，帮你整理兴趣和下一步。")}</p></div>
      <div className="auth-side-footnote"><LockKeyhole size={15}/>{t("数据仅保存在当前浏览器，不与学校身份系统关联")}</div>
    </div>
    <div className="auth-main"><div className="auth-top"><Brand /><AppearanceControls/></div>
      <div className="auth-form-wrap"><p className="muted-kicker">WELCOME TO YOUR SPACE</p><h1>{t("从这里开始")}</h1><p className="form-intro">{t("用一个昵称，创建自己的本地科研档案。")}</p>
        {accounts.length > 0 && <div className="account-list"><div className="tiny-section-head">{t("继续使用已有档案")}</div>{accounts.map((account) => <button className="account-pick" key={account.id} onClick={() => void select(account.id)} disabled={busy}><Avatar name={account.nickname} tone={account.avatarTone}/><span><strong>{account.nickname}</strong><small>{t("继续探索")}</small></span><ArrowRight size={18}/></button>)}<div className="auth-divider"><span>{t("或者，新建一份档案")}</span></div></div>}
        <form onSubmit={submit}><label className="field-label" htmlFor="nickname">{t("怎么称呼你？")}</label><input id="nickname" className="input" maxLength={24} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("输入你的昵称")} autoComplete="nickname"/>
          <div className="field-label field-label-spaced">{t("选择一个代表你的颜色")}</div><div className="tone-selector">{tones.map((value) => <button key={value} type="button" onClick={() => setTone(value)} aria-label={t("选择{0}颜色", { "0": value })} aria-pressed={tone === value} className={`tone-swatch tone-${value} ${tone === value ? 'selected' : ''}`}>{tone === value && '✓'}</button>)}</div>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <button disabled={busy} type="submit" className="btn btn-primary full-width auth-submit"><Plus size={18}/>{busy ? t("正在创建...") : t("创建我的科研档案")}<ArrowRight size={18}/></button>
        </form><div className="local-notice"><UserRound size={18}/><p><strong>{t("关于本地账户")}</strong><br />{t("它不是学校或云端身份认证。切换浏览器或设备不会自动同步；可在设置中导出备份。")}</p></div>
        <Link to="/" className="understated-link">{t("先看看平台介绍")}<ArrowUpRight size={15}/></Link>
      </div>
    </div>
  </div>;
}
