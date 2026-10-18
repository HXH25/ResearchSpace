import { translate as t } from '@/app/i18n';
import type { HostApi, ResearchModule, ModuleId, FacultySearchQuery, OpportunitySearchQuery, AiPort, AiGenerateRequest, AiGenerateResponse, CommunityConfig, } from '@/sdk/contracts';
import { createModuleStorage } from '@/app/services/db';
const community: CommunityConfig = {
    repo: import.meta.env.VITE_COMMUNITY_REPO || null,
    repoId: import.meta.env.VITE_COMMUNITY_REPO_ID || null,
    category: import.meta.env.VITE_COMMUNITY_CATEGORY || null,
    categoryId: import.meta.env.VITE_COMMUNITY_CATEGORY_ID || null,
};
const proxyUrl = import.meta.env.VITE_AI_PROXY_URL?.trim() ?? '';
const appMode: 'demo' | 'live' = 'live';
const ai: AiPort = {
    state: proxyUrl ? 'ready' : 'unconfigured',
    async generate(request: AiGenerateRequest, signal?: AbortSignal): Promise<AiGenerateResponse> {
        if (request.containsPersonalData && !request.personalDataConsent)
            throw new Error(t("尚未同意向外部 AI 发送个人资料"));
        if (!proxyUrl)
            throw new Error(t("尚未配置 AI 代理。请使用模块提供的本地模板。"));
        const response = await fetch(proxyUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request), signal,
        });
        if (!response.ok)
            throw new Error(t("AI 服务暂时不可用（HTTP {0}）", { "0": response.status }));
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('text' in data) || typeof data.text !== 'string') {
            throw new Error(t("AI 服务返回了无效的数据格式"));
        }
        return {
            text: data.text, mode: 'live', provider: 'configured-proxy', createdAt: new Date().toISOString(),
        };
    },
};
export function makeHostApi(args: {
    userId: string;
    moduleId: ModuleId;
    modules: Partial<Record<ModuleId, ResearchModule>>;
    navigate: (path: string) => void;
    ui?: HostApi['config']['ui'];
    aiPort?: AiPort;
}): HostApi {
    const { userId, moduleId, modules, navigate } = args;
    function safeNavigate(path: string) {
        // Normalize dot segments and encoded traversal before allowing navigation.
        if (!/^\/app(?:\/|\?|$)/.test(path) || path.startsWith('//') || /[\\\r\n]/.test(path)) {
            throw new Error(t("模块导航只能指向 /app 站内页面"));
        }
        const parsed = new URL(path, 'https://researchspace.invalid');
        if (parsed.origin !== 'https://researchspace.invalid' || !/^\/app(?:\/|$)/.test(parsed.pathname)) {
            throw new Error(t("模块导航不能跳出 /app"));
        }
        navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    }
    return {
        navigation: {
            go: safeNavigate,
            facultyPath: (id: string) => `/app/faculty/${encodeURIComponent(id)}`,
            opportunityPath: (id: string) => `/app/opportunities/${encodeURIComponent(id)}`,
        },
        catalog: {
            async searchFaculty(query: FacultySearchQuery, signal?: AbortSignal) {
                try {
                    return (await modules.faculty?.providers?.faculty?.search(query, signal)) ?? [];
                }
                catch (error) {
                    console.warn('faculty provider failed', error);
                    return [];
                }
            },
            async getFacultyById(id: string, signal?: AbortSignal) {
                try {
                    return (await modules.faculty?.providers?.faculty?.getById(id, signal)) ?? null;
                }
                catch (error) {
                    console.warn('faculty provider failed', error);
                    return null;
                }
            },
            async searchOpportunities(query: OpportunitySearchQuery, signal?: AbortSignal) {
                try {
                    return (await modules.opportunities?.providers?.opportunities?.search(query, signal)) ?? [];
                }
                catch (error) {
                    console.warn('opportunities provider failed', error);
                    return [];
                }
            },
            async getOpportunityById(id: string, signal?: AbortSignal) {
                try {
                    return (await modules.opportunities?.providers?.opportunities?.getById(id, signal)) ?? null;
                }
                catch (error) {
                    console.warn('opportunities provider failed', error);
                    return null;
                }
            },
        },
        storage: createModuleStorage(userId, moduleId),
        ai: args.aiPort ?? ai,
        config: { appMode, community, ui: args.ui },
    };
}
