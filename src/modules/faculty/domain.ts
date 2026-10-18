import { z } from 'zod';
import type { FacultyRecord, StudentProfile } from '@/sdk/contracts';

export const areas: Record<string, string> = {
  'ai-computing': 'AI 与计算', 'math-physics': '数学与物理', 'bio-medicine': '生命与医学',
  'electronics-engineering': '电子与工程', 'social-sciences': '人文与社科',
  'economics-management': '经济与管理', 'design-interdisciplinary': '设计与交叉',
};
export const skills: Record<string, string> = {
  programming: '编程', math: '数学 / 理论', experiment: '实验 / 仪器', 'data-analysis': '数据分析',
  'literature-reading': '文献阅读', 'design-research': '设计 / 调研', writing: '写作 / 表达',
};
export const workLabels: Record<string, string> = { literature: '读论文', coding: '写代码', theory: '理论推导', experiments: '做实验', data: '处理数据', fieldwork: '实地调研' };
export const statusLabels = { confirmed_open: '已证实开放', past_opening: '历史曾招募', closed: '明确关闭', unknown: '招募未知' };
export function safeUrl(value?: string): string | undefined {
  try { const url = new URL(value ?? ''); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
const httpUrl = z.string().refine(value => Boolean(safeUrl(value)), '来源必须是 http(s) 链接');
const dateTime = z.iso.datetime({ offset: true });
const sourceSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), url: httpUrl,
  type: z.enum(['official', 'academic', 'media', 'community', 'mock']), publisher: z.string().optional(),
  publishedAt: dateTime.optional(), accessedAt: dateTime, note: z.string().optional(),
});
export const facultySchema = z.object({
  id: z.string().min(1), name: z.string().min(1), nameEnglish: z.string().optional(), institution: z.string().min(1),
  department: z.string().optional(), officialPage: httpUrl.optional(), publiclyListedContactEmail: z.email().optional(),
  researchAreas: z.array(z.string()), researchSummary: z.string(),
  selectedWorks: z.array(z.object({ title: z.string(), year: z.number().int().optional(), url: httpUrl.optional(), doi: z.string().optional() })).optional(),
  groupName: z.string().optional(), groupPage: httpUrl.optional(),
  teamMembers: z.array(z.object({
    name: z.string(), role: z.enum(['faculty', 'postdoc', 'phd', 'masters', 'undergraduate', 'alumni', 'other']),
    researchInterests: z.array(z.string()).optional(), publicPageUrl: httpUrl.optional(), sourceIds: z.array(z.string()),
  })).optional(),
  undergraduateParticipation: z.string().optional(), dailyMentorship: z.string().optional(),
  recruitmentStatus: z.enum(['confirmed_open', 'past_opening', 'closed', 'unknown']), recruitmentVerifiedAt: dateTime.optional(),
  lastCheckedAt: dateTime, sources: z.array(sourceSchema), isDemo: z.boolean(),
});
const entrySchema = z.object({
  faculty: facultySchema,
  metadata: z.object({origin: z.string(), topics: z.array(z.string()), listedBy: z.array(z.string()), positions: z.array(z.string()), appointmentFlags: z.array(z.string()), srtProjectIds: z.array(z.string()), retrievalMethod: z.string(), evidence: z.string(), note: z.string()}).optional(),
  keywords: z.array(z.string()).default([]),
  // Module-only editorial suggestions; these are never represented as admission requirements.
  preparation: z.object({ skills: z.array(z.string()), workPreferences: z.array(z.enum(['literature', 'coding', 'theory', 'experiments', 'data', 'fieldwork', 'undecided'])), task: z.string() }).optional(),
  factSourceIds: z.object({
    background: z.array(z.string()).default([]), works: z.array(z.string()).default([]), team: z.array(z.string()).default([]),
    participation: z.array(z.string()).default([]), mentorship: z.array(z.string()).default([]), recruitment: z.array(z.string()).default([]),
  }).default({ background: [], works: [], team: [], participation: [], mentorship: [], recruitment: [] }),
  media: z.array(z.object({ title: z.string(), publisher: z.string(), publishedAt: dateTime, url: httpUrl, topic: z.string(), sourceIds: z.array(z.string()) })).default([]),
});
export type FacultyEntry = z.infer<typeof entrySchema>;
export function recentlyVerified(value?: string, now = Date.now()): boolean {
  const age = now - Date.parse(value ?? '');
  return Number.isFinite(age) && age >= 0 && age <= 90 * 24 * 60 * 60 * 1000;
}
export function parseEntries(value: unknown, now = Date.now()): FacultyEntry[] {
  const entries = z.array(entrySchema).parse(value);
  const ids = new Set<string>();
  for (const entry of entries) {
    const faculty = entry.faculty;
    if (ids.has(faculty.id)) throw new Error('资料存在重复编号，请核对数据来源。');
    ids.add(faculty.id);
    faculty.isDemo = faculty.isDemo || faculty.sources.some(source => source.type === 'mock');
    if (new Set(faculty.sources.map(source => source.id)).size !== faculty.sources.length) throw new Error('来源编号重复，无法准确引用。');
    const sourced = (ids: string[], official = false) => faculty.sources.some(source => ids.includes(source.id) && (!official || source.type === 'official'));
    // Invalid attribution is removed at the boundary, including records returned to other modules.
    if (!sourced(entry.factSourceIds.background, !faculty.isDemo)) {
      faculty.officialPage = undefined; faculty.publiclyListedContactEmail = undefined;
    }
    if (!sourced(entry.factSourceIds.team, !faculty.isDemo)) { faculty.groupName = undefined; faculty.groupPage = undefined; }
    faculty.teamMembers = faculty.teamMembers?.filter(member => sourced(member.sourceIds, !faculty.isDemo));
    if (!sourced(entry.factSourceIds.participation, !faculty.isDemo)) faculty.undergraduateParticipation = undefined;
    if (!sourced(entry.factSourceIds.mentorship, !faculty.isDemo)) faculty.dailyMentorship = undefined;
    if (!sourced(entry.factSourceIds.works)) faculty.selectedWorks = [];
    if (!sourced(entry.factSourceIds.recruitment, !faculty.isDemo)) faculty.recruitmentStatus = 'unknown';
    if (faculty.recruitmentStatus === 'confirmed_open' && (faculty.isDemo || !recentlyVerified(faculty.recruitmentVerifiedAt, now))) faculty.recruitmentStatus = 'unknown';
    entry.media = entry.media.filter(item => sourced(item.sourceIds, !faculty.isDemo));
  }
  return entries;
}
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/\bllms?\b|大语言模型|大模型|语言模型/g, '大语言模型')
    .replace(/\bmachine learning\b/g, '机器学习').replace(/\brobotics?\b/g, '机器人')
    .replace(/\bprotein\b/g, '蛋白质').replace(/\bhallucinations?\b/g, '幻觉');
}
export function searchText(entry: FacultyEntry): string {
  const f = entry.faculty;
  return normalizeText([f.name, f.nameEnglish, f.institution, f.department, f.groupName, f.researchSummary,
    ...f.researchAreas.map(area => areas[area] ?? area), ...entry.keywords, ...(f.selectedWorks ?? []).map(work => work.title)].join(' '));
}
export function matchesText(entry: FacultyEntry, query = ''): boolean {
  const haystack = searchText(entry);
  return normalizeText(query).split(/[\s,，;；]+/).filter(Boolean).every(term => haystack.includes(term));
}
export function explainMatch(entry: FacultyEntry, profile: StudentProfile) {
  const f = entry.faculty;
  const overlap = profile.researchAreas.filter(area => f.researchAreas.includes(area));
  const keywords = profile.interestKeywords.filter(keyword => keyword.trim() && searchText(entry).includes(normalizeText(keyword.trim())));
  const weights = (profile.researchAreas.length ? 60 : 0) + (profile.interestKeywords.filter(k => k.trim()).length ? 40 : 0);
  const points = (profile.researchAreas.length ? 60 * overlap.length / profile.researchAreas.length : 0) +
    (profile.interestKeywords.filter(k => k.trim()).length ? 40 * keywords.length / profile.interestKeywords.filter(k => k.trim()).length : 0);
  const supportedSkills = (entry.preparation?.skills ?? []).filter(skill => profile.skills.includes(skill));
  const evidence = (profile.skillEvidence ?? []).filter(item => supportedSkills.includes(item.skill) && item.description.trim());
  const work = (entry.preparation?.workPreferences ?? []).filter(pref => profile.workPreferences.includes(pref));
  const unknowns = ['尚无具体项目的时间、申请资格和名额要求，无法判断当前能否加入。'];
  if (!weights) unknowns.push('你尚未选择研究兴趣，暂不计算兴趣匹配分；可以先自由浏览。');
  if (!profile.skills.filter(skill => skill !== 'none').length) unknowns.push('尚未填写可用技能，不代表缺乏科研潜力。');
  if (!evidence.length) unknowns.push('暂无与建议技能对应的经历描述；不能据此确认熟练程度。');
  if (!f.dailyMentorship) unknowns.push('日常指导安排未知，不能推断是否符合你的指导偏好。');
  if (profile.weeklyHours == null || profile.availability === 'undecided') unknowns.push('可投入时间或开始时间尚未确定。');
  const guidance = profile.guidancePreference === 'structured' ? '希望有明确任务与反馈' : profile.guidancePreference === 'independent' ? '希望更多自主探索' : '指导偏好尚未确定';
  const availability: Record<string, string> = { now: '尽快开始', this_term: '本学期', next_term: '下学期', summer: '暑假', undecided: '开始时间待定' };
  return {
    score: weights ? Math.round(points / weights * 100) : null,
    interest: [...overlap.map(area => areas[area] ?? area), ...keywords],
    scoreExplanation: weights ? `按已填写的领域交集（${profile.researchAreas.length ? 60 : 0} 权重）与关键词命中（${profile.interestKeywords.filter(k => k.trim()).length ? 40 : 0} 权重）归一到 100 分。只衡量文本兴趣交集。` : '兴趣未确定时不打分。',
    preparation: supportedSkills.map(skill => `${skills[skill] ?? skill}（${evidence.some(item => item.skill === skill) ? '有经历描述，尚未核验' : '画像自述'}）`),
    evidence: (profile.skillEvidence ?? []).filter(item => item.description.trim()).map(item => `${skills[item.skill] ?? (item.skill === 'course-project' ? '课程 / 个人项目（未自动关联为技能证明）' : item.skill)}：${item.description}`),
    work: work.map(pref => workLabels[pref] ?? pref), guidance,
    time: `${availability[profile.availability]} · ${profile.weeklyHours == null ? '每周时长待定' : `每周 ${profile.weeklyHours} 小时（画像填写）`}`,
    unknowns,
    task: entry.preparation?.task ?? '先读一份公开研究介绍，写下研究问题、一个不熟悉的概念和一个想问的问题。',
    usedFields: ['研究领域', '兴趣关键词', '自述技能与经历证据', '工作偏好', '指导偏好', '可开始时间与每周时长'],
  };
}
export function isDemoRecord(record: Pick<FacultyRecord, 'isDemo' | 'sources'>) { return record.isDemo || record.sources.some(source => source.type === 'mock'); }

export const relatedSchema = z.array(z.object({
  id: z.string(), title: z.string(), institution: z.string(), linkedFacultyIds: z.array(z.string()).optional(),
  eligibility: z.enum(['tsinghua_only', 'home_institution_only', 'international_eligible', 'open_to_all', 'unknown']),
  status: z.enum(['open_confirmed', 'upcoming', 'closed', 'unknown']), statusVerifiedAt: dateTime.optional(),
  deadlineAt: dateTime.optional(), sources: z.array(sourceSchema), isDemo: z.boolean(),
}));
export function opportunityStatus(item: z.infer<typeof relatedSchema>[number]) {
  if (item.deadlineAt && Date.parse(item.deadlineAt) < Date.now()) return '已过截止时间';
  if (item.status === 'open_confirmed' && (item.isDemo || item.sources.some(source => source.type === 'mock') || !recentlyVerified(item.statusVerifiedAt) || !item.sources.some(source => source.type === 'official'))) return '招募状态待核实';
  return { open_confirmed: '开放已确认', upcoming: '即将开放', closed: '已关闭', unknown: '招募状态待核实' }[item.status];
}
