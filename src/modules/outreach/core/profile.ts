import type { StudentProfile } from '@/sdk/contracts';
import type { ProfileChoice } from '../types';
import { clean } from './safety';

const areas: Record<string, [string, string]> = {
  'ai-computing': ['AI 与计算','AI and computing'], 'math-physics':['数学与物理','mathematics and physics'],
  'bio-medicine':['生命与医学','biology and medicine'], 'electronics-engineering':['电子与工程','electronics and engineering'],
  'social-sciences':['人文与社科','humanities and social sciences'], 'economics-management':['经济与管理','economics and management'],
  'design-interdisciplinary':['设计与交叉','design and interdisciplinary research'],
};
export function profileChoices(profile: StudentProfile): ProfileChoice[] {
  const result: ProfileChoice[] = [];
  const add = (id: string, label: string, text: string, english: string, kind: ProfileChoice['kind']) => {
    if (text.trim()) result.push({ id, label, text: clean(text), english: clean(english), kind });
  };
  add('student:institution','学校（请确认默认值）',profile.institution,profile.institution,'identity');
  if (profile.department) add('student:department','院系',profile.department,profile.department,'identity');
  const years: Record<string, [string,string]> = { year1:['本科一年级','first-year undergraduate'],year2:['本科二年级','second-year undergraduate'],year3:['本科三年级','third-year undergraduate'],year4:['本科四年级','fourth-year undergraduate'],year5:['本科五年级','fifth-year undergraduate'] };
  if (years[profile.undergraduateYear]) add('student:year','年级',...years[profile.undergraduateYear],'identity');
  profile.researchAreas.slice(0,15).forEach((v,i) => add(`student:area:${i}`,'兴趣',...(areas[v] || [v,v]),'interest'));
  profile.interestKeywords.slice(0,15).forEach((v,i) => add(`student:keyword:${i}`,'兴趣关键词',v,v,'interest'));
  // Quiz skill selections are interests/preparation signals, not proof of research achievements.
  (profile.skillEvidence || []).slice(0,12).forEach((v,i) => add(`student:evidence:${i}`,'本人确认的经历',v.description,v.description,'experience'));
  if (profile.weeklyHours !== undefined) add('student:hours','每周投入',String(profile.weeklyHours),String(profile.weeklyHours),'availability');
  const times: Record<string,[string,string]> = { now:['现在','now'],this_term:['本学期','this academic term'],next_term:['下学期','next academic term'],summer:['暑假','the summer break'] };
  if (times[profile.availability]) add('student:start','计划开始时间',...times[profile.availability],'availability');
  return result;
}
