import { translate as t } from '@/app/i18n';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Pencil, Sparkles, UserRound } from 'lucide-react';
import type { StudentProfile } from '@/sdk/contracts';
import type { LocalAccount } from '@/app/services/db';
import { PageHeading, Pill, SectionEyebrow, Avatar } from '@/ui/components';
import { AREAS, EXPERIENCES, findLabels, GOALS, GUIDANCE, SKILLS, TIMES, WORKS, summarizeProfile, profileCompleteness } from '@/app/utils/profile';
const rowValue = (v: string) => v || t("暂未填写");
export function ProfilePage({ account, profile }: {
    account: LocalAccount;
    profile: StudentProfile;
}) {
    const navigate = useNavigate();
    const summary = summarizeProfile(profile);
    return <div className="profile-page"><PageHeading eyebrow="YOUR RESEARCH PROFILE" title={t("我的科研画像")} description={t("这是一份不断更新的探索记录，不是对能力的评判。")}><button className="btn btn-primary" onClick={() => navigate('/onboarding')}><Pencil size={16}/>{t("编辑画像")}</button></PageHeading>
    <section className="profile-top-card"><div className="profile-top-person"><Avatar name={account.nickname} tone={account.avatarTone} size="lg"/><div><h2>{account.nickname}</h2><p>{summary.year} · {profile.department || t("尚未填写专业")} · {profile.institution || t("未填写学校")}</p></div></div><div className="profile-completion"><div><Sparkles size={17}/>{t("画像资料完成度")}</div><strong>{profileCompleteness(profile)}%</strong></div></section>
    <div className="profile-grid"><section className="profile-detail-card"><SectionEyebrow>INTERESTS & GOALS</SectionEyebrow><h3>{t("我想探索什么")}</h3><div className="profile-information"><span>{t("感兴趣的方向")}</span><div className="tag-group">{findLabels(profile.researchAreas, AREAS).length ? findLabels(profile.researchAreas, AREAS).map(x => <Pill key={x} tone="green">{x}</Pill>) : <span className="empty-text">{t("还没有确定，可以慢慢来")}</span>}</div></div><div className="profile-information"><span>{t("感兴趣的具体问题")}</span><p>{rowValue(profile.interestKeywords.join('、'))}</p></div><div className="profile-information"><span>{t("参与目标")}</span><div className="tag-group">{findLabels(profile.goals, GOALS).map(x => <Pill key={x}>{x}</Pill>)}{profile.goals.length === 0 && <span className="empty-text">{t("暂无")}</span>}</div></div></section>
      <section className="profile-detail-card"><SectionEyebrow>SKILLS & EXPERIENCE</SectionEyebrow><h3>{t("我从哪里开始")}</h3><div className="profile-information"><span>{t("目前经历")}</span><p>{t(EXPERIENCES.find(x => x.value === profile.experience)?.label)}</p></div><div className="profile-information"><span>{t("熟悉的技能")}</span><div className="tag-group">{findLabels(profile.skills, SKILLS).map(x => <Pill key={x}>{x}</Pill>)}{profile.skills.length === 0 && <span className="empty-text">{t("尚未填写")}</span>}</div></div><div className="profile-information"><span>{t("已填写的项目经历")}</span><p>{profile.skillEvidence?.find(x => x.skill === 'course-project')?.description || t("还没有填写")}</p></div><div className="profile-information"><span>{t("想尝试的任务")}</span><p>{rowValue(findLabels(profile.workPreferences, WORKS).join(t('、')))}</p></div></section>
      <section className="profile-detail-card"><SectionEyebrow>TIME & GUIDANCE</SectionEyebrow><h3>{t("我希望怎样参与")}</h3><div className="profile-information with-icon"><Clock size={19}/><span>{t("每周时间")}</span><strong>{summary.hours}</strong></div><div className="profile-information with-icon"><CalendarDays size={19}/><span>{t("开始时间")}</span><strong>{t(TIMES.find(x => x.value === profile.availability)?.label)}</strong></div><div className="profile-information with-icon"><UserRound size={19}/><span>{t("指导偏好")}</span><strong>{t(GUIDANCE.find(x => x.value === profile.guidancePreference)?.label)}</strong></div></section>
      <section className="profile-detail-card profile-guidance-card"><SectionEyebrow>WHAT THIS MEANS</SectionEyebrow><h3>{t("画像如何被使用？")}</h3><div className="promise-row"><CheckCircle2 size={20}/><span>{t("帮助解释推荐理由，而非预测人格或科研潜力")}</span></div><div className="promise-row"><CheckCircle2 size={20}/><span>{t("申请条件与项目是否正在招募会单独核实")}</span></div><div className="promise-row"><CheckCircle2 size={20}/><span>{t("向外部 AI 发送资料前需由你明确同意")}</span></div><button className="text-button" onClick={() => navigate('/app/faculty')}>{t("用画像探索导师")}<ArrowRight size={15}/></button></section></div>
  </div>;
}
