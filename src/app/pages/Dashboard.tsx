import { translate as t } from '@/app/i18n';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarClock, Check, Compass, GraduationCap, Mail, MessagesSquare, MoveUpRight, NotebookPen, Sparkles, WandSparkles, } from 'lucide-react';
import type { StudentProfile } from '@/sdk/contracts';
import type { LocalAccount } from '@/app/services/db';
import { installedModules, moduleSlots } from '@/app/services/modules';
import { findLabels, AREAS, profileCompleteness, summarizeProfile } from '@/app/utils/profile';
import { Avatar, PageHeading, Pill, SectionEyebrow } from '@/ui/components';
const cardIcons = { faculty: GraduationCap, opportunities: CalendarClock, community: MessagesSquare, outreach: Mail };
function NextStep({ profile }: {
    profile: StudentProfile;
}) {
    const steps = [
        { title: t("找到一个值得深入的方向"), text: t("浏览研究方向和问题，不需要一开始就决定未来。"), to: '/app/faculty', icon: Compass },
        { title: t("看看有哪些具体机会"), text: profile.goals.includes('srt') ? t("优先了解 SRT 等清华本科生科研渠道。") : t("看项目的任务、门槛和投入要求。"), to: '/app/opportunities', icon: BookOpen },
        { title: t("准备一个能够提出的问题"), text: t("无论是问学长学姐还是联系老师，先把问题写具体。"), to: '/app/outreach', icon: NotebookPen },
    ];
    return <div className="next-steps">{steps.map((s, i) => <Link key={t(s.title)} className="next-step" to={s.to}><span className="step-number">{String(i + 1).padStart(2, '0')}</span><span className="next-step-main"><strong>{t(s.title)}</strong><small>{t(s.text)}</small></span><ArrowUpRight size={18}/></Link>)}</div>;
}
export function Dashboard({ account, profile }: {
    account: LocalAccount;
    profile: StudentProfile;
}) {
    const summary = summarizeProfile(profile);
    const interests = findLabels(profile.researchAreas, AREAS);
    const percent = profileCompleteness(profile);
    const hour = new Date().getHours();
    const greeting = hour < 5 ? t("夜深了") : hour < 11 ? t("早上好") : hour < 13 ? t("中午好") : hour < 18 ? t("下午好") : t("晚上好");
    return <div className="dashboard-page">
    <PageHeading eyebrow="MY RESEARCH JOURNEY" title={t('{0}，{1} ✳', {0:greeting,1:account.nickname})} description={t("科研不需要从一个完美的计划开始。今天，先找到一个值得继续探索的问题。")}><Pill tone="green"><Sparkles size={13}/>{t("我的空间")}</Pill></PageHeading>
    <div className="dashboard-hero"><div className="dash-hero-text"><div className="dash-overline"><span className="online-dot"/>{t("你的科研起点")}</div><h2>{t("从认识自己，")}<br />{t("到发现值得投入的研究。")}</h2><p>{t("使用导师探索、科研机会和联系邮件，继续你的科研探索。你的本地画像可以随时修改。")}</p><Link to="/app/profile" className="light-button">{t("查看我的画像")}<ArrowRight size={17}/></Link></div><div className="dash-hero-art" aria-hidden="true"><div className="center-emblem"><Compass size={44} strokeWidth={1.3}/></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/><span className="orbit-dot dot-three"/><span className="dash-hero-orbit orbit-first"/><span className="dash-hero-orbit orbit-second"/></div></div>
    <div className="dashboard-cols"><section className="dash-main-col"><div className="component-heading"><div><SectionEyebrow>DISCOVER</SectionEyebrow><h2>{t("你可以从这里开始")}</h2></div><span className="quiet-text">{t("3 个功能模块")}</span></div><div className="dashboard-module-grid">{moduleSlots.map((mod) => { const Icon = cardIcons[mod.id]; const installed = Boolean(installedModules[mod.id]); return <Link key={mod.id} to={`/app/${mod.id}`} className={`dash-module dash-module-${mod.accent}`}><div className="dash-module-top"><span className="dash-module-icon"><Icon size={23}/></span><MoveUpRight size={18}/></div><h3>{t(mod.title)}</h3><p>{t(mod.description)}</p><div className="module-bottom"><span>{installed ? t("已接入 \u00B7 点击探索") : t("模块待安装 \u00B7 查看接入位")}</span><ArrowRight size={15}/></div></Link>; })}</div>
      <div className="component-heading lower-heading"><div><SectionEyebrow>NEXT STEPS</SectionEyebrow><h2>{t("下一步，试试这些")}</h2></div></div><NextStep profile={profile}/>
    </section><aside className="dash-aside-col"><div className="insight-card"><div className="insight-head"><SectionEyebrow>MY PROFILE</SectionEyebrow><Link to="/app/profile" className="subtle-link">{t("编辑")}<ArrowUpRight size={14}/></Link></div><div className="insight-person"><Avatar name={account.nickname} tone={account.avatarTone} size="lg"/><div><strong>{account.nickname}</strong><small>{summary.year} · {profile.department || t("本科生")}</small></div></div><div className="profile-meter"><div><span>{t("画像细化程度")}</span><strong>{percent}%</strong></div><div className="meter-track"><span style={{ width: `${percent}%` }}/></div><small>{t("只是资料的完整程度，不代表科研能力")}</small></div><div className="mini-detail"><span>{t("关注的方向")}</span><strong>{summary.areas}</strong></div><div className="mini-detail"><span>{t("每周可投入")}</span><strong>{summary.hours}</strong></div><div className="tag-group">{interests.length ? interests.slice(0, 4).map((s) => <Pill key={s}>{s}</Pill>) : <Pill>{t("正在探索方向")}</Pill>}</div></div>
      <div className="gentle-card"><WandSparkles size={23}/><h3>{t("没有经验，也可以开始。")}</h3><p>{t("你可以从一篇论文、一次公开报告、一个简单复现任务开始探索。")}</p><Link to="/app/opportunities">{t("发现机会")}<ArrowRight size={15}/></Link></div>
      <div className="hint-card"><Check size={17}/><span>{t("你的个人画像不会自动发送给导师或第三方服务。")}</span></div>
    </aside></div>
  </div>;
}
