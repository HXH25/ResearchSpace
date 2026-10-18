import { useUiPreferences } from '@/app/preferences/store';
import { AppearanceControls } from '@/app/components/AppearanceControls';
import { translate as t } from '@/app/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BellDot, ChevronDown, CircleHelp, Compass, GraduationCap, Home, Mail, Menu, MessageCircle, Search, Settings2, Sparkles, UserRound, X, CalendarClock, } from 'lucide-react';
import type { StudentProfile, ModuleId } from '@/sdk/contracts';
import type { LocalAccount } from '@/app/services/db';
import { makeHostApi } from '@/app/services/hostApi';
import { useServiceSettings, userAi } from '@/integrations/client';
import { scopeModules } from '@/integrations/projects';
import { installedModules, moduleSlots } from '@/app/services/modules';
import { Dashboard } from '@/app/pages/Dashboard';
import { ModuleSlot } from '@/app/pages/ModuleSlot';
import { ProfilePage } from '@/app/pages/ProfilePage';
import { Settings } from '@/app/pages/Settings';
import { Avatar, Brand } from '@/ui/components';
const navIcons = { faculty: GraduationCap, opportunities: CalendarClock, community: MessageCircle, outreach: Mail };
function SideItem({ to, icon: Icon, children, small }: {
    to: string;
    icon: typeof Home;
    children: ReactNode;
    small?: string;
}) {
    return <NavLink to={to} end={to === '/app'} className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}><Icon size={19}/><span>{children}</span>{small && <small>{small}</small>}</NavLink>;
}
export function Shell({ account, profile, onSwitch, onDeleted }: {
    account: LocalAccount;
    profile: StudentProfile;
    onSwitch: () => void;
    onDeleted: () => Promise<void>;
}) {
    const navigate = useNavigate();
    const ui = useUiPreferences();
    const serviceState = useServiceSettings(account.id);
    const services = serviceState.data;
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState<'faculty' | 'opportunities'>('faculty');
    const apiById = useMemo(() => Object.fromEntries((['faculty', 'opportunities', 'outreach'] as ModuleId[]).map((id) => [id, makeHostApi({ userId: account.id, moduleId: id, modules: scopeModules(installedModules, account.id), navigate, ui, aiPort: userAi(account.id, Boolean(services?.ai[services.active.ai]?.ready)) })])) as Record<ModuleId, ReturnType<typeof makeHostApi>>, [account.id, navigate, ui, services]);
    function search() { const q = query.trim(); if (q)
        navigate(`/app/${searchType}?q=${encodeURIComponent(q)}`); }
    const menu = <>
    <div className="sidebar-header"><Brand /><button className="close-mobile" onClick={() => setMobileOpen(false)} aria-label={t("关闭导航")}><X size={23}/></button></div>
    <div className="side-main"><div className="side-group-label">{t("我的空间")}</div><SideItem to="/app" icon={Home}>{t("科研首页")}</SideItem><SideItem to="/app/profile" icon={UserRound}>{t("我的科研画像")}</SideItem><div className="side-group-label side-group-second">{t("探索科研")}</div>
      {moduleSlots.map((item) => { const Icon = navIcons[item.id]; return <SideItem key={item.id} to={`/app/${item.id}`} icon={Icon} small={installedModules[item.id] ? '' : '·'}>{t(item.title)}</SideItem>; })}
      <div className="side-group-label side-group-second">{t("更多")}</div><SideItem to="/app/settings" icon={Settings2}>{t("设置与隐私")}</SideItem></div>
    <div className="sidebar-bottom"><div className="sidebar-tip"><Sparkles size={19}/><strong>{t("科研没有唯一的起点")}</strong><p>{t("认真提出一个问题，就是很好的开始。")}</p></div><button className="sidebar-account" onClick={onSwitch}><Avatar name={account.nickname} tone={account.avatarTone} size="sm"/><span><strong>{account.nickname}</strong><small>{t("切换本地档案")}</small></span><ChevronDown size={16}/></button></div>
  </>;
    return <div className="app-shell">
    <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>{menu}</aside>{mobileOpen && <button type="button" className="mobile-scrim" aria-label={t("关闭导航")} onClick={() => setMobileOpen(false)}/>}
    <div className="app-workspace"><header className="app-topbar"><div className="topbar-left"><button className="mobile-menu-button" aria-label={t("打开导航")} onClick={() => setMobileOpen(true)}><Menu size={22}/></button><div className="breadcrumb"><Compass size={17}/><span>ResearchSpace</span><span className="slash">/</span><strong>{t("本科生科研空间")}</strong></div></div>
      <form className="global-search" onSubmit={(e) => { e.preventDefault(); search(); }}><Search size={18}/><input aria-label={t("搜索导师或项目")} placeholder={searchType === 'faculty' ? t("搜索导师 / 研究方向") : t("搜索科研项目 / 机会")} value={query} onChange={(e) => setQuery(e.target.value)}/><select aria-label={t("搜索类型")} value={searchType} onChange={(e) => setSearchType(e.target.value as 'faculty' | 'opportunities')}><option value="faculty">{t("导师")}</option><option value="opportunities">{t("项目")}</option></select></form>
      <AppearanceControls/><div className="topbar-actions"><Link to="/app/settings" title={t("设置")} className="icon-only"><BellDot size={19}/></Link><Link to="/app/profile" title={t("我的科研画像")}><Avatar name={account.nickname} tone={account.avatarTone} size="sm"/></Link></div>
    </header><main className="app-page"><Routes>
      <Route index element={<Dashboard account={account} profile={profile}/>}/>
      <Route path="profile" element={<ProfilePage account={account} profile={profile}/>}/>
      <Route path="settings" element={<Settings key={account.id} userId={account.id} onDeleted={onDeleted} onReload={() => window.location.reload()}/>}/>
      {moduleSlots.map((item) => { const id = item.id; return <Route key={id} path={`${id}/*`} element={<ModuleSlot id={id} module={installedModules[id]} api={apiById[id]} profile={profile}/>}/>; })}
      <Route path="*" element={<div className="not-found"><CircleHelp size={44}/><h1>{t("这个页面似乎还没准备好")}</h1><p>{t("你可以回到探索首页，重新选择想去的地方。")}</p><Link className="btn btn-primary" to="/app">{t("返回首页")}<ArrowRight size={16}/></Link></div>}/>
    </Routes></main></div>
  </div>;
}
