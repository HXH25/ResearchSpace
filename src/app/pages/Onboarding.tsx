import { AppearanceControls } from '@/app/components/AppearanceControls';
import { translate as t } from '@/app/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { StudentProfile } from '@/sdk/contracts';
import { Brand, Pill } from '@/ui/components';
import { AREAS, EXPERIENCES, GOALS, GUIDANCE, HOURS, HOURS_LABELS, SKILLS, TIMES, WORKS, YEARS, toggleValue } from '@/app/utils/profile';
const headings = [
    { kicker: 'ABOUT YOU', title: '你好，先认识一下你。', subtitle: '你现在处于哪个阶段？之后随时可以修改。' },
    { kicker: 'YOUR WHY', title: '你想从科研中获得什么？', subtitle: '可以多选，不需要现在就想清楚全部目标。' },
    { kicker: 'INTERESTS', title: '有什么问题让你好奇？', subtitle: '选感兴趣的主题。即使还没决定方向，也没有关系。' },
    { kicker: 'WHAT YOU KNOW', title: '从你已有的经历开始。', subtitle: '课程作业、自己的小项目，同样是可以分享的起点。' },
    { kicker: 'HOW YOU WORK', title: '你更喜欢怎样做研究？', subtitle: '先选你想尝试的工作方式，遇到实际项目后可以调整。' },
    { kicker: 'YOUR TIME', title: '下一段科研旅程，何时开始？', subtitle: '根据时间和投入意愿，帮你过滤不合适的机会。' },
];
function OptionCard({ selected, onClick, title, description }: {
    selected: boolean;
    onClick: () => void;
    title: string;
    description?: string;
}) {
    return <button type="button" onClick={onClick} aria-pressed={selected} className={`option-card ${selected ? 'option-selected' : ''}`}><span className="option-indicator">{selected && <Check size={13} strokeWidth={3}/>}</span><span className="option-text"><strong>{t(title)}</strong>{description && <small>{t(description)}</small>}</span></button>;
}
function Chip({ active, onClick, children }: {
    active: boolean;
    onClick: () => void;
    children: string;
}) {
    return <button type="button" onClick={onClick} aria-pressed={active} className={`choice-chip ${active ? 'choice-active' : ''}`}>{active && <Check size={14}/>} {t(children)}</button>;
}
export function Onboarding({ initial, onSave, editing = false }: {
    initial: StudentProfile;
    onSave: (profile: StudentProfile) => Promise<void>;
    editing?: boolean;
}) {
    const [step, setStep] = useState(0);
    const [keywordInput, setKeywordInput] = useState(initial.interestKeywords.join('、'));
    const [value, setValue] = useState<StudentProfile>({ ...initial });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();
    const current = headings[step];
    function update(patch: Partial<StudentProfile>) { setValue((s) => ({ ...s, ...patch })); }
    const project = value.skillEvidence?.find((item) => item.skill === 'course-project')?.description ?? '';
    function updateProject(description: string) {
        const rest = (value.skillEvidence ?? []).filter((item) => item.skill !== 'course-project');
        update({ skillEvidence: description.trim() ? [...rest, { skill: 'course-project', description: description.slice(0, 500) }] : rest });
    }
    async function next() {
        if (busy)
            return;
        if (step < 5) {
            setStep((s) => s + 1);
            setError('');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await onSave({ ...value, onboardingCompletedAt: value.onboardingCompletedAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
            navigate('/app');
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : t("保存失败"));
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="onboard-scene"><header className="onboard-header container"><Brand /><div className="onboard-header-right"><AppearanceControls/><Pill tone="green">STEP {step + 1} / 6</Pill>{editing && <button className="text-button" onClick={() => navigate('/app/profile')}>{t("退出编辑")}</button>}</div></header>
    <div className="onboard-layout container"><aside className="onboard-aside"><p>{t("构建我的科研画像")}</p><h2>{t("从好奇心出发，")}<br /><em>{t("找到自己的方向。")}</em></h2><div className="onboard-index">{headings.map((h, i) => <button type="button" key={h.kicker} onClick={() => setStep(i)} className={`onboard-index-step ${i === step ? 'current' : ''} ${i < step ? 'past' : ''}`}><span>{i < step ? <Check size={14}/> : String(i + 1).padStart(2, '0')}</span><span>{[t("我的阶段"), t("参与目标"), t("感兴趣的方向"), t("技能与经历"), t("科研方式"), t("时间与投入")][i]}</span></button>)}</div><div className="aside-note"><Sparkles size={18}/><p>{t("这份画像用于提供个性化建议，而不是给你的科研能力打分。")}</p></div></aside>
      <section className="onboard-panel"><div className="onboard-progress"><span style={{ width: `${(step + 1) / 6 * 100}%` }}/></div><div className="onboard-panel-inner"><div className="step-kicker">{current.kicker} <span>· {step + 1} OF 6</span></div><h1>{t(current.title)}</h1><p className="step-subtitle">{t(current.subtitle)}</p>
        <div className="step-form">
          {step === 0 && <><div className="field-label">{t("你现在是？")}</div><div className="choice-grid three">{YEARS.map((a) => <OptionCard key={a.value} selected={value.undergraduateYear === a.value} onClick={() => update({ undergraduateYear: a.value })} title={t(a.label)}/>)}</div><label className="field-label field-label-spaced" htmlFor="institution">{t("学校（可修改）")}</label><input id="institution" className="input" maxLength={120} value={value.institution} onChange={(e) => update({ institution: e.target.value.slice(0, 120) })} placeholder={t("例如：清华大学")}/><label className="field-label field-label-spaced" htmlFor="department">{t("院系或专业（选填）")}</label><input id="department" className="input" value={value.department ?? ''} onChange={(e) => update({ department: e.target.value.slice(0, 80) })} placeholder={t("例如：计算机科学与技术")}/><p className="muted-hint">{t("你可以不是清华学生；第一版的主要科研资源会先以清华为重点。")}</p></>}
          {step === 1 && <><div className="field-label">{t("我想要……")}<span className="optional">{t("可多选")}</span></div><div className="choice-grid two">{GOALS.map((a) => <OptionCard key={a.value} selected={value.goals.includes(a.value)} onClick={() => update({ goals: toggleValue(value.goals, a.value, 5) })} title={t(a.label)} description={t(a.description)}/>)}</div><p className="muted-hint">{t("还不知道也可以直接下一步，之后根据探索经历再调整。")}</p></>}
          {step === 2 && <><div className="field-label">{t("哪些领域让你想多了解一点？")}<span className="optional">{t("可多选")}</span></div><div className="choice-grid two">{AREAS.map((a) => <OptionCard key={a.value} selected={value.researchAreas.includes(a.value)} onClick={() => update({ researchAreas: toggleValue(value.researchAreas, a.value, 5) })} title={t(a.label)}/>)}</div><label className="field-label field-label-spaced" htmlFor="keywords">{t("有更具体的兴趣吗？（选填）")}</label><input className="input" id="keywords" value={keywordInput} onChange={(e) => { setKeywordInput(e.target.value); update({ interestKeywords: e.target.value.split(/[,，、]/g).map(s => s.trim()).filter(Boolean).slice(0, 8) }); }} placeholder={t("比如：视频生成、环境保护、芯片设计")}/></>}
          {step === 3 && <><div className="field-label">{t("你目前有过哪些经历？")}</div><div className="choice-grid two">{EXPERIENCES.map((a) => <OptionCard key={a.value} selected={value.experience === a.value} onClick={() => update({ experience: a.value })} title={t(a.label)} description={t(a.description)}/>)}</div><div className="field-label field-label-spaced">{t("你希望发挥哪些技能？")}<span className="optional">{t("可多选")}</span></div><div className="chip-list">{SKILLS.map((a) => <Chip key={a.value} active={value.skills.includes(a.value)} onClick={() => update({ skills: a.value === 'none' ? ['none'] : toggleValue(value.skills.filter(s => s !== 'none'), a.value) })}>{t(a.label)}</Chip>)}</div><label className="field-label field-label-spaced" htmlFor="project-evidence">{t("做过的课程或个人小项目（选填）")}</label><textarea id="project-evidence" className="input profile-note-field" value={project} onChange={(e) => updateProject(e.target.value)} placeholder={t("例如：做过一个图像分类课程项目，负责训练和结果分析。只写真实做过的内容。")} maxLength={500} rows={3}/><p className="muted-hint">{t("还没有科研经历，也完全可以开始探索；这段经历仅保存在本地画像中。")}</p></>}
          {step === 4 && <><div className="field-label">{t("哪些科研任务想先体验一下？")}<span className="optional">{t("可多选")}</span></div><div className="chip-list large-gaps">{WORKS.map((a) => <Chip key={a.value} active={value.workPreferences.includes(a.value)} onClick={() => update({ workPreferences: a.value === 'undecided' ? ['undecided'] : toggleValue(value.workPreferences.filter(s => s !== 'undecided'), a.value) })}>{t(a.label)}</Chip>)}</div><div className="field-label field-label-spaced">{t("你期待什么样的指导？")}</div><div className="choice-grid one">{GUIDANCE.map((a) => <OptionCard key={a.value} selected={value.guidancePreference === a.value} onClick={() => update({ guidancePreference: a.value })} title={t(a.label)} description={t(a.description)}/>)}</div></>}
          {step === 5 && <><div className="field-label">{t("希望什么时候开始？")}</div><div className="choice-grid two">{TIMES.map((a) => <OptionCard key={a.value} selected={value.availability === a.value} onClick={() => update({ availability: a.value })} title={t(a.label)}/>)}</div><div className="field-label field-label-spaced">{t("每周大概能投入多少时间？")}</div><div className="chip-list">{HOURS.map((hours) => <Chip key={hours} active={value.weeklyHours === hours || (hours === 0 && value.weeklyHours === undefined)} onClick={() => update({ weeklyHours: hours === 0 ? undefined : hours })}>{HOURS_LABELS[hours]}</Chip>)}</div><div className="field-label field-label-spaced">{t("希望科研信息优先用哪种语言？")}</div><div className="chip-list">{(['zh', 'en'] as const).map((lang) => <Chip key={lang} active={value.preferredLanguages.includes(lang)} onClick={() => update({ preferredLanguages: toggleValue(value.preferredLanguages.filter(l => l !== 'other'), lang) })}>{lang === 'zh' ? t("中文") : 'English'}</Chip>)}</div></>}
        </div>
        {error && <p role="alert" className="form-error">{t(error)}</p>}
        <div className="onboard-bottom"><button type="button" disabled={step === 0} className="btn btn-outline" onClick={() => setStep(s => Math.max(0, s - 1))}><ChevronLeft size={18}/>{t("上一步")}</button><span className="onboard-keyhint">{t("全部问题都可以之后修改")}</span><button type="button" disabled={busy} className="btn btn-primary" onClick={next}>{step === 5 ? (busy ? t("正在保存...") : editing ? t("保存画像") : t("完成画像")) : t("下一步")} {step === 5 ? <ArrowRight size={17}/> : <ChevronRight size={18}/>}</button></div>
      </div></section></div>
    <div className="mobile-onboard-bottom">{step > 0 && <button className="text-button" onClick={() => setStep(s => s - 1)}><ArrowLeft size={16}/>{t("上一步")}</button>}<button className="btn btn-primary" disabled={busy} onClick={next}>{step === 5 ? t("完成画像") : t("下一步")} <ArrowRight size={16}/></button></div>
  </div>;
}
