import { translate as t } from '@/app/i18n';
import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Box, ChevronRight, CircleHelp, Code2, GraduationCap, Mail, NotebookTabs, ShieldCheck, Shapes, } from 'lucide-react';
import type { ModuleId, ResearchModule, StudentProfile } from '@/sdk/contracts';
import type { HostApi } from '@/sdk/contracts';
import { PageHeading, Pill, SectionEyebrow } from '@/ui/components';
import { moduleSlots } from '@/app/services/modules';
const details: Record<Exclude<ModuleId, 'community'>, {
    features: string[];
    icon: typeof GraduationCap;
    tagline: string;
}> = {
    faculty: { icon: GraduationCap, tagline: '从科研背景到课题组生活，了解你想认识的研究者。', features: ['导师学术经历与公开资料', '课题组公开成员与参与经历', '基于画像的可解释匹配建议', '公开报告 / 视频资料索引'] },
    opportunities: { icon: NotebookTabs, tagline: '将清华 SRT 和国内外本科生科研机会整理成清晰的入口。', features: ['学校 / 地区 / 申请资格筛选', '研究内容、时间与申请方式', '招募状态与核实时间', '从项目关联导师与联系邮件'] },
    outreach: { icon: Mail, tagline: '一封具体、真实、有针对性的科研联系邮件。', features: ['中英双语套瓷邮件编辑器', '引用个人画像与公开导师资料', '本地模板 / 可替换 AI 服务', '邮件草稿保存、复制和导出'] },
};
class ModuleErrorBoundary extends Component<{
    children: ReactNode;
    moduleTitle: string;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error) { console.error(`Module ${this.props.moduleTitle} crashed`, error); }
    render() {
        if (this.state.failed)
            return <div className="module-error"><CircleHelp size={32}/><h2>{t("模块暂时无法显示")}</h2><p>{t("模块渲染时出现了错误，其余功能仍可正常使用。请检查该模块的开发日志。")}</p><Link to="/app" className="btn btn-outline">{t("返回首页")}</Link></div>;
        return this.props.children;
    }
}
export function ModuleSlot({ id, profile, api, module }: {
    id: ModuleId;
    profile: StudentProfile;
    api: HostApi;
    module?: ResearchModule;
}) {
    if (module) {
        const Root = module.Root;
        return <ModuleErrorBoundary key={`${id}:${profile.userId}`} moduleTitle={t(module.title)}><Root profile={profile} api={api}/></ModuleErrorBoundary>;
    }
    const slot = moduleSlots.find((m) => m.id === id)!;
    const info = details[id as Exclude<ModuleId, 'community'>];
    const Icon = info.icon;
    return <div className="module-placeholder"><PageHeading eyebrow={`MODULE / ${id.toUpperCase()}`} title={t(slot.title)} description={t(info.tagline)}><Pill tone="amber"><Box size={13}/>{t("模块待安装")}</Pill></PageHeading>
    <section className="placeholder-hero"><div><span className="placeholder-kicker"><Shapes size={16}/> RESEARCHSPACE EXTENSION</span><h2>{t("这里，为下一位开发者")}<br />{t("预留了一个完整的空间。")}</h2><p>{t("当前是主程序的可交互占位页。对应 Agent 的模块包到位后，无需修改导航或路由，功能会自动出现在这里。")}</p><div className="placeholder-actions"><Link to="/app" className="btn btn-primary">{t("返回探索首页")}<ArrowRight size={16}/></Link><Link to="/app/settings" className="btn btn-outline">{t("查看集成状态")}</Link></div></div><div className={`placeholder-icon placeholder-${id}`}><Icon size={68} strokeWidth={1.3}/></div></section>
    <div className="placeholder-content"><section className="placeholder-list"><SectionEyebrow>PLANNED FEATURES</SectionEyebrow><h3>{t("该模块计划提供")}</h3>{info.features.map((f, i) => <div className="placeholder-feature" key={t(f)}><span>{String(i + 1).padStart(2, '0')}</span><strong>{t(f)}</strong><ChevronRight size={16}/></div>)}</section><section className="placeholder-guide"><div className="guide-head"><Code2 size={22}/><h3>{t("开发者接入说明")}</h3></div><p>{t("将 Agent 的 ZIP 解压到主程序根目录，确保入口文件符合下列路径：")}</p><code>src/modules/{id}/module.tsx</code><p>{t("默认导出")}<strong>ResearchModule</strong>{t("，使用协议版本")}<strong>1.0.0</strong>{t("，并从")}<strong>@/sdk/contracts</strong>{t("引入统一类型。")}</p><div className="guide-divider"/><div className="guide-status"><ShieldCheck size={17}/><span>{t("宿主的路由、画像与模块存储已就绪")}</span></div></section></div>
  </div>;
}
