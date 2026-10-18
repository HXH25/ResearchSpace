import { translate as t } from '@/app/i18n';
import type { ResearchModule, ModuleId, ModuleIcon } from '@/sdk/contracts';
import { CONTRACT_VERSION } from '@/sdk/contracts';
const ALLOWED_IDS: readonly ModuleId[] = ['faculty', 'opportunities', 'outreach'];
const ALLOWED_ICONS: readonly ModuleIcon[] = [
    'graduation-cap', 'flask-conical', 'messages-square', 'mail',
];
/**
 * Feature agents only need to install src/modules/<id>/module.tsx.
 * There are deliberately no default exports for the four uninstalled modules.
 */
const discovered = import.meta.glob<{
    default: ResearchModule;
}>('../../modules/*/module.tsx', { eager: true });
export const moduleLoadErrors: string[] = [];
export function validateModule(candidate: unknown, filename: string): candidate is ResearchModule {
    if (!candidate || typeof candidate !== 'object') {
        moduleLoadErrors.push(t("{0}: 没有导出模块描述对象", { "0": filename }));
        return false;
    }
    const value = candidate as Partial<ResearchModule>;
    if (!ALLOWED_IDS.includes(value.id as ModuleId)) {
        moduleLoadErrors.push(t("{0}: 非法模块 ID {1}", { "0": filename, "1": String(value.id) }));
        return false;
    }
    if (!filename.replace(/\\/g, '/').endsWith(`/modules/${value.id}/module.tsx`)) {
        moduleLoadErrors.push(t("{0}: 模块 ID 与安装目录不一致", { "0": filename }));
        return false;
    }
    if (value.contractVersion !== CONTRACT_VERSION) {
        moduleLoadErrors.push(t("{0}: 协议版本错误，需要 {1}", { "0": filename, "1": CONTRACT_VERSION }));
        return false;
    }
    if (!value.Root || (typeof value.Root !== 'function' && typeof value.Root !== 'object')) {
        moduleLoadErrors.push(t("{0}: 缺少有效的 React Root 组件", { "0": filename }));
        return false;
    }
    if (typeof value.title !== 'string' || !value.title.trim() ||
        typeof value.summary !== 'string' || !value.summary.trim() ||
        !ALLOWED_ICONS.includes(value.icon as ModuleIcon)) {
        moduleLoadErrors.push(t("{0}: title / summary / icon 不符合协议", { "0": filename }));
        return false;
    }
    return true;
}
const byId: Partial<Record<ModuleId, ResearchModule>> = {};
const rejectedIds = new Set<ModuleId>();
for (const [filename, entry] of Object.entries(discovered)) {
    if (!validateModule(entry?.default, filename))
        continue;
    const module = entry.default;
    if (byId[module.id] || rejectedIds.has(module.id)) {
        moduleLoadErrors.push(`${filename}: 重复模块 ID ${module.id}，本次忽略所有重复模块`);
        delete byId[module.id];
        rejectedIds.add(module.id);
        continue;
    }
    byId[module.id] = module;
}
export const installedModules = byId;
export const installedCount = Object.keys(byId).length;
export const moduleSlots: Array<{
    id: ModuleId;
    title: string;
    description: string;
    accent: string;
}> = [
    { id: 'faculty', title: '导师探索', description: '了解研究经历、课题组和与你相关的研究问题。', accent: 'mint' },
    { id: 'opportunities', title: '科研机会', description: '清华 SRT、科研助理，以及国内外公开本科科研项目。', accent: 'peach' },
    { id: 'outreach', title: '联系邮件', description: '用真实的个人经历与公开导师资料写好第一封邮件。', accent: 'blue' },
];
