import { translate as t } from '@/app/i18n';
import type { StudentProfile, ResearchExperience, StudentGoal, WorkPreference, GuidancePreference, AvailabilityWindow, UndergraduateYear } from '@/sdk/contracts';
export const YEARS: Array<{
    value: UndergraduateYear;
    label: string;
}> = [
    { value: 'year1', label: '大一' }, { value: 'year2', label: '大二' }, { value: 'year3', label: '大三' },
    { value: 'year4', label: '大四' }, { value: 'year5', label: '五年级' }, { value: 'undecided', label: '暂不确定' },
];
export const GOALS: Array<{
    value: StudentGoal;
    label: string;
    description: string;
}> = [
    { value: 'explore_research', label: '探索研究方向', description: '先找到让自己好奇的问题' },
    { value: 'join_lab', label: '进入课题组', description: '想更长期地参与研究' },
    { value: 'srt', label: '参加 SRT', description: '体验一段有计划的科研' },
    { value: 'summer_research', label: '暑期科研', description: '希望利用暑假集中投入' },
    { value: 'overseas_research', label: '海外科研', description: '探索国际公开机会' },
    { value: 'postgraduate_preparation', label: '为深造做准备', description: '提前体验科研生活' },
];
export const AREAS = [
    { value: 'ai-computing', label: 'AI 与计算', icon: 'cpu' }, { value: 'math-physics', label: '数学与物理', icon: 'orbit' },
    { value: 'bio-medicine', label: '生命与医学', icon: 'heart-pulse' }, { value: 'electronics-engineering', label: '电子与工程', icon: 'circuit-board' },
    { value: 'social-sciences', label: '人文与社科', icon: 'book-open' }, { value: 'economics-management', label: '经济与管理', icon: 'chart-no-axes-combined' },
    { value: 'design-interdisciplinary', label: '设计与交叉', icon: 'palette' },
];
export const SKILLS = [
    { value: 'programming', label: '编程' }, { value: 'math', label: '数学 / 理论' },
    { value: 'experiment', label: '实验 / 仪器' }, { value: 'data-analysis', label: '数据分析' },
    { value: 'literature-reading', label: '文献阅读' }, { value: 'design-research', label: '设计 / 调研' },
    { value: 'writing', label: '写作 / 表达' }, { value: 'none', label: '还没有明确技能' },
];
export const EXPERIENCES: Array<{
    value: ResearchExperience;
    label: string;
    description: string;
}> = [
    { value: 'none', label: '零经验', description: '我还没有参加过科研' },
    { value: 'course_projects', label: '课程项目', description: '做过课程设计、比赛或个人作品' },
    { value: 'prior_research', label: '科研经历', description: '参与过课题或科研训练' },
    { value: 'undecided', label: '不确定', description: '不确定哪些经历算科研' },
];
export const WORKS: Array<{
    value: WorkPreference;
    label: string;
}> = [
    { value: 'literature', label: '读论文' }, { value: 'coding', label: '写代码' }, { value: 'theory', label: '理论推导' },
    { value: 'experiments', label: '做实验' }, { value: 'data', label: '处理数据' }, { value: 'fieldwork', label: '实地调研' },
    { value: 'undecided', label: '想先都体验一下' },
];
export const GUIDANCE: Array<{
    value: GuidancePreference;
    label: string;
    description: string;
}> = [
    { value: 'structured', label: '明确任务和反馈', description: '希望有人带着入门' },
    { value: 'independent', label: '更多自主探索', description: '喜欢自己推进一个想法' },
    { value: 'undecided', label: '还不确定', description: '先从经历中了解自己' },
];
export const TIMES: Array<{
    value: AvailabilityWindow;
    label: string;
}> = [
    { value: 'now', label: '尽快开始' }, { value: 'this_term', label: '本学期' },
    { value: 'next_term', label: '下学期' }, { value: 'summer', label: '暑假' }, { value: 'undecided', label: '暂未决定' },
];
export const HOURS = [0, 3, 5, 8, 10, 15, 20];
export const HOURS_LABELS: Record<number, string> = {
    0: '不确定', 3: '每周约 3 小时', 5: '每周约 5 小时', 8: '每周约 8 小时',
    10: '每周约 10 小时', 15: '每周约 15 小时', 20: '每周 20 小时或以上',
};
export const findLabels = (values: readonly string[], items: Array<{
    value: string;
    label: string;
}>) => values.map((v) => t(items.find((item) => item.value === v)?.label ?? v));
export function defaultProfile(userId: string, displayName: string): StudentProfile {
    return {
        schemaVersion: 1, userId, displayName, institution: 'Tsinghua University',
        undergraduateYear: 'undecided', goals: [], researchAreas: [], interestKeywords: [], skills: [],
        experience: 'undecided', workPreferences: [], guidancePreference: 'undecided',
        availability: 'undecided', preferredLanguages: ['zh'], updatedAt: new Date().toISOString(),
    };
}
export function summarizeProfile(profile: StudentProfile) {
    const areas = findLabels(profile.researchAreas, AREAS);
    const goals = findLabels(profile.goals, GOALS);
    return {
        areas: areas.length ? areas.join(t('、')) : t("还在探索中"),
        goals: goals.length ? goals.join(t('、')) : t("寻找科研的第一步"),
        year: t(YEARS.find((y) => y.value === profile.undergraduateYear)?.label ?? '未填写'),
        skills: findLabels(profile.skills, SKILLS).filter((s) => s !== t("还没有明确技能")),
        hours: profile.weeklyHours == null || profile.weeklyHours === 0 ? t("尚未确定") : t("每周约 {0} 小时", { "0": profile.weeklyHours }),
    };
}
export function profileCompleteness(profile: StudentProfile): number {
    const checks = [
        profile.undergraduateYear !== 'undecided', profile.goals.length > 0,
        profile.researchAreas.length > 0 || profile.interestKeywords.length > 0,
        profile.experience !== 'undecided', profile.workPreferences.length > 0,
        profile.availability !== 'undecided',
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
export function toggleValue<T extends string>(list: T[], value: T, max = Infinity): T[] {
    if (list.includes(value))
        return list.filter((v) => v !== value);
    return list.length >= max ? list : [...list, value];
}
