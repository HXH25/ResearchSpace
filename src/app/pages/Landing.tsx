import { AppearanceControls } from '@/app/components/AppearanceControls';
import { translate as t } from '@/app/i18n';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Blocks, Compass, GraduationCap, HeartHandshake, MailOpen, Sparkles, ShieldCheck, MapPinned, MoveUpRight, } from 'lucide-react';
import { Brand, Footer, SectionEyebrow } from '@/ui/components';
function scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const highlights = [
    { number: '01', title: '认识研究者', desc: '从公开科研经历与团队信息出发，找到你真正想深入了解的人。', icon: GraduationCap },
    { number: '02', title: '发现机会', desc: '清华 SRT 与校内外公开科研项目，了解参与条件和下一步。', icon: MapPinned },
    { number: '03', title: '迈出第一步', desc: '根据真实经历准备一封有针对性、可信且得体的联系邮件。', icon: MailOpen },
];
export function Landing({ hasAccount }: {
    hasAccount: boolean;
}) {
    return <div className="landing">
    <header className="landing-header container">
      <Brand />
      <AppearanceControls/><div className="landing-actions"><button type="button" className="top-text-link feature-jump" onClick={scrollToFeatures}>{t("探索功能")}</button>
      <Link className="btn btn-ghost btn-small" to={hasAccount ? '/app' : '/welcome'}>{hasAccount ? t("进入我的空间") : t("登录 / 创建档案")}</Link></div>
    </header>
    <main>
      <section className="landing-hero container">
        <div className="landing-hero-content">
          <div className="hero-eyebrow"><Sparkles size={15}/>{t("专为本科生设计的科研起点")}<span className="tiny-dot"/></div>
          <h1>{t("你的科研旅程，")}<br /><span>{t("从好奇开始。")}</span></h1>
          <p className="landing-intro">{t("科研不该是一扇不知道如何敲开的门。在这里，了解方向、认识导师、发现机会，找到下一步值得尝试的事。")}</p>
          <div className="hero-buttons"><Link to={hasAccount ? '/app' : '/welcome'} className="btn btn-primary btn-large">{t("开启我的探索")}<ArrowRight size={19}/></Link><button type="button" onClick={scrollToFeatures} className="btn btn-plain btn-large">{t("先看看能做什么")}<ArrowUpRight size={18}/></button></div>
          <div className="hero-trust"><ShieldCheck size={17}/><span>{t("无需学校认证 \u00B7 个人画像保存在本地 \u00B7 由你决定分享什么")}</span></div>
        </div>
        <div className="hero-art" aria-label={t("示意：兴趣、导师、机会之间的连接")}>
          <div className="orbit-line orbit-line-a"/><div className="orbit-line orbit-line-b"/>
          <div className="orbital-note orbital-note-top"><span>✦</span>{t("对什么感兴趣？")}</div>
          <div className="orbital-card main-orbital-card"><span className="orbital-card-symbol"><Compass size={30}/></span><div className="orbital-label">{t("我的科研探索")}</div><div className="orbital-title">{t("去发现下一种可能")}</div><div className="orbital-tags"><span>{t("研究方向")}</span><span>{t("公开机会")}</span></div></div>
          <div className="orbital-chip orbital-chip-left"><GraduationCap size={19}/><span>{t("认识导师")}</span></div>
          <div className="orbital-chip orbital-chip-right"><HeartHandshake size={19}/><span>{t("找到同路人")}</span></div>
          <div className="orbital-note orbital-note-bottom"><span className="orbital-green-dot"/>{t("从一次提问，到一次尝试")}</div>
          <div className="art-spark art-spark-1">✳</div><div className="art-spark art-spark-2">✧</div>
        </div>
      </section>
      <section className="feature-section" id="features"><div className="container">
        <div className="section-title-row"><div><SectionEyebrow>WHAT YOU CAN DO</SectionEyebrow><h2>{t("从一个问题，到三种连接")}</h2><p>{t("每个功能都可以独立探索，也能连接成一条完整的科研起步路径。")}</p></div><span className="feature-count">01 — 03</span></div>
        <div className="feature-grid">{highlights.map(({ number, title, desc, icon: Icon }) => <article className="feature-tile" key={number}><div className="feature-tile-top"><span>{number}</span><Icon size={23}/></div><h3>{t(title)}</h3><p>{t(desc)}</p><MoveUpRight size={17} className="feature-arrow"/></article>)}</div>
      </div></section>
      <section className="how-section container"><div className="how-card"><div><SectionEyebrow>HOW IT WORKS</SectionEyebrow><h2>{t("先认识自己，")}<br />{t("再认识科研。")}</h2><p>{t("六个简单的问题，没有标准答案。从你的兴趣、经验和时间出发，慢慢生成一张属于自己的科研画像。")}</p><Link className="btn btn-primary" to={hasAccount ? '/app' : '/welcome'}>{t("开始建立画像")}<ArrowRight size={16}/></Link></div><div className="how-visual"><div className="how-step"><span>01</span><div>{t("你想探索什么？")}<small>{t("兴趣不确定，也完全可以。")}</small></div><Compass size={23}/></div><div className="how-step"><span>02</span><div>{t("你有哪些经历？")}<small>{t("课程、作品、好奇心都能成为起点。")}</small></div><Blocks size={23}/></div><div className="how-step"><span>03</span><div>{t("你希望如何开始？")}<small>{t("把下一步变成具体行动。")}</small></div><Sparkles size={23}/></div></div></div></section>
    </main><Footer />
  </div>;
}
