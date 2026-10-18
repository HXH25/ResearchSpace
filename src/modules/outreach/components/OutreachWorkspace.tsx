import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Mail, Search, Sparkles, X } from 'lucide-react';
import type { ModulePageProps, FacultyRecord, OpportunityRecord } from '@/sdk/contracts';
import type { Diagnostic, DraftDocument, DraftInput, EmailPlan, Language, OutreachOverrides, Purpose, ResearchResult } from '../types';
import { LANGUAGES } from '../types';
import { buildPlan } from '../core/plan';
import { profileChoices } from '../core/profile';
import { parseHandoff } from '../core/handoff';
import { createDraftRepository } from '../core/storage';
import { generateTemplates, makeDocument } from '../core/service';
import { generateAi, makeAiRequest } from '../core/ai';
import { diagnostic, httpUrl, checkpoint } from '../core/safety';
import { facultySchema, opportunitySchema } from '../core/schemas';
import { draftText } from '../core/template';
import { languageLabels, purposeLabels, opportunityStatusLabels, eligibilityLabels } from '../core/locales';
import { createResearcher } from '../providers/research';
import { DefaultPanel } from './DefaultPanel';
import { ConsentDialog } from './ConsentDialog';
import { DraftEditor } from './DraftEditor';

export function OutreachWorkspace({profile,api,overrides,search}:{profile:ModulePageProps['profile'];api:ModulePageProps['api'];overrides:OutreachOverrides;search:string}) {
  const [input,setInput]=useState<DraftInput>(()=>({
    profile,selectedProfileIds:[],faculty:null,opportunity:null,handoff:null,
    manual:{name:'',institution:'',email:'',officialPage:'',researchSummary:'',identityConfirmed:false,researchConfirmed:false},
    projectReview:{contactAllowed:false,eligible:false,officialSourceUrl:'',email:'',checked:false,purpose:null},
    signature:profile.displayName,purpose:'research_enquiry',tone:'formal',length:'standard',
    reading:{title:'',level:'introduction',confirmed:false},materials:[],followUpDate:'',followUpConfirmed:false,
    identityConfirmed:false,facultyResearchConfirmed:false,
  }));
  const [languages,setLanguages]=useState<Language[]>(['zh-CN','en']);
  const [diagnostics,setDiagnostics]=useState<Diagnostic[]>([]);
  const [taskId,setTaskId]=useState('initial');
  const [busy,setBusy]=useState(false);const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');const [failure,setFailure]=useState('');
  const [results,setResults]=useState<ResearchResult|null>(null);
  const [documents,setDocuments]=useState<DraftDocument[]>([]);const [activeId,setActiveId]=useState('');
  const [saved,setSaved]=useState<DraftDocument[]>([]);const [deleting,setDeleting]=useState<string|null>(null);
  const [pending,setPending]=useState<{plan:EmailPlan;languages:Language[]}|null>(null);
  const [repository]=useState(()=>overrides.repository?.(api,profile.userId)||createDraftRepository(api.storage,profile.userId));
  const [researcher]=useState(()=>overrides.researcher?.(api)||createResearcher(api.catalog,overrides.search,overrides.fetch));
  const alive=useRef(true);const running=useRef<AbortController|null>(null);
  const generation=useRef(0);
  const active=documents.find(d=>d.id===activeId)||null;
  const choices=profileChoices(profile);
  const patch=(p:Partial<DraftInput>)=>{setInput(v=>{
    const next={...v,...p};
    const recipientChanged=p.manual&&(p.manual.name!==v.manual.name||p.manual.email!==v.manual.email||p.manual.institution!==v.manual.institution||p.manual.officialPage!==v.manual.officialPage);
    if((p.purpose&&p.purpose!==v.purpose)||recipientChanged)next.projectReview={...next.projectReview,checked:false,contactAllowed:false,purpose:null};
    return next;
  });setPending(null);};
  const manual=(p:Partial<DraftInput['manual']>)=>patch({manual:{...input.manual,...p,identityConfirmed:false,researchConfirmed:false}});
  function report(error:unknown,message?:string) {if(!alive.current)return;const d=diagnostic(error,message);setFailure(d.message);setDiagnostics(v=>[...v,d]);}
  function begin(){running.current?.abort();const controller=new AbortController();running.current=controller;generation.current++;setTaskId(String(generation.current));setDiagnostics([]);setFailure('');setNotice('');setBusy(true);return controller;}
  function current(c:AbortController){return alive.current&&running.current===c&&!c.signal.aborted;}
  function finish(c:AbortController){if(current(c)){setBusy(false);running.current=null;}}
  function chooseFaculty(f:FacultyRecord){setInput(v=>({...v,faculty:f,identityConfirmed:false,facultyResearchConfirmed:false,projectReview:{...v.projectReview,checked:false,contactAllowed:false,purpose:null},manual:{name:f.name,institution:f.institution,email:f.publiclyListedContactEmail||'',officialPage:f.officialPage||'',researchSummary:f.researchSummary,identityConfirmed:false,researchConfirmed:false}}));setPending(null);}
  function chooseOpportunity(o:OpportunityRecord){setInput(v=>({...v,opportunity:o,handoff:null,projectReview:{contactAllowed:false,eligible:false,officialSourceUrl:'',email:'',checked:false,purpose:null}}));setPending(null);}
  useEffect(()=>{
    alive.current=true;
    repository.list().then(v=>{if(alive.current)setSaved(v);}).catch(e=>report(e,'本地草稿暂时无法读取，可先生成并下载邮件。'));
    return()=>{alive.current=false;running.current?.abort();};
    // The workspace is remounted by profile/user/URL; adapters are fixed per mount.
  },[repository]);
  useEffect(()=>{
    const params=new URLSearchParams(search),f=params.get('facultyId'),o=params.get('opportunityId');
    if(!f&&!o)return;
    const c=begin();
    void (async()=>{
      const values=await Promise.allSettled([f?api.catalog.getFacultyById(f,c.signal):Promise.resolve(null),o?api.catalog.getOpportunityById(o,c.signal):Promise.resolve(null)]);
      checkpoint(c.signal,()=>current(c));
      if(f){const p=facultySchema.safeParse(values[0].status==='fulfilled'?values[0].value:null);if(p.success)chooseFaculty(p.data);else setDiagnostics(v=>[...v,{code:'FACULTY_UNAVAILABLE',level:'warning',message:'原导师记录不可用，可手动填写公开资料。'}]);}
      if(o){const p=opportunitySchema.safeParse(values[1].status==='fulfilled'?values[1].value:null);if(p.success)chooseOpportunity(p.data);else setDiagnostics(v=>[...v,{code:'PROJECT_UNAVAILABLE',level:'warning',message:'原项目记录不可用；不会据此生成正式项目申请。'}]);}
    })().catch(e=>{if(current(c))report(e);}).finally(()=>finish(c));
    return()=>c.abort();
  },[search]);
  async function research(){
    if(!input.manual.name.trim()){setFailure('先填写导师姓名或机构称呼。');return;}
    const c=begin();setResults(null);
    try {const r=await researcher.research({name:input.manual.name,institution:input.manual.institution,homepage:input.manual.officialPage},c.signal);checkpoint(c.signal,()=>current(c));setResults(r);setDiagnostics(r.diagnostics);setNotice(`找到 ${r.faculty.length} 条导师记录、${r.opportunities.length} 条项目线索。请核对后选择。`);}
    catch(e){if(current(c)){setDiagnostics(v=>[...v,diagnostic(e,'查询未完成，可使用已知的公开资料手动填写。')]);setNotice('查询已结束，可继续填写已知的公开资料。');}}finally{finish(c);}
  }
  function getPlan(){if(!languages.length)throw new Error('languages');return overrides.planner?overrides.planner.plan(input):buildPlan(input);}
  async function localGenerate(){
    const c=begin();
    try {const plan=getPlan();const payloads=await generateTemplates(plan,languages,overrides,c.signal);checkpoint(c.signal,()=>current(c));const docs=payloads.map(p=>makeDocument(plan,p,'template'));setDocuments(docs);setActiveId(docs[0].id);setNotice('草稿已生成，可编辑并保存。');}
    catch(e){if(current(c))report(e);}finally{finish(c);}
  }
  function prepareAi(){setFailure('');try{setPending({plan:getPlan(),languages:[...languages]});}catch(e){report(e);}}
  async function approvedAi(){
    const selected=pending;if(!selected)return;setPending(null);const c=begin();
    try {
      const r=await generateAi({ai:api.ai,plan:selected.plan,languages:selected.languages,consent:true,signal:c.signal,isCurrent:()=>current(c),validator:overrides.validator});
      checkpoint(c.signal,()=>current(c));const docs=r.drafts.map(p=>makeDocument(selected.plan,p,r.mode));setDocuments(docs);setActiveId(docs[0].id);
      if(r.repaired)setDiagnostics([{code:'AI_REPAIRED',level:'info',message:'首次输出未通过校验，已使用相同事实进行一次修复。'}]);
      setNotice(r.mode==='ai-demo'?'已生成 AI 演示草稿，请勿当作真实模型调用。':'AI 草稿已生成，请核对事实和译文。');
    }catch(e){if(current(c))report(e,'AI 服务暂时不可用，原草稿已保留；可使用本地模板。');}finally{finish(c);}
  }
  function changeDoc(doc:DraftDocument){setDocuments(v=>v.map(d=>d.id===doc.id?doc:d));setNotice('');}
  async function save(){if(!active)return;setSaving(true);setFailure('');try{await repository.save({...active,updatedAt:new Date().toISOString()});const list=await repository.list();if(alive.current){setSaved(list);setNotice('已保存到当前账号。');}}catch(e){report(e,'草稿未保存，请先下载文本保留内容。');}finally{if(alive.current)setSaving(false);}}
  function fullText(){return active?`${active.plan.recipientEmail?`To: ${active.plan.recipientEmail}\n`:''}Subject: ${active.payload.subject}\n\n${draftText(active.payload)}\n`:'';}
  async function copy(){try{await navigator.clipboard.writeText(fullText());if(alive.current)setNotice('邮件已复制。');}catch{setFailure('浏览器未允许复制，请选择文本复制或下载 .txt。');}}
  function download(){if(!active)return;const blob=new Blob([fullText()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${active.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,70)}_${active.payload.language}.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('已导出邮件文本；附件需在邮箱客户端自行添加。');}
  async function remove(id:string){setSaving(true);try{await repository.remove(id);const list=await repository.list();if(alive.current){setSaved(list);setDeleting(null);setNotice('已删除保存的草稿。');}}catch(e){report(e,'删除未完成，原草稿已保留。');}finally{if(alive.current)setSaving(false);}}
  async function importHandoff(file:File){
    if(file.size>180000){setFailure('交接文件超过 180 KB，请导出单个项目的交接。');return;}
    const c=begin();try{const h=parseHandoff(JSON.parse(await file.text()),profile);checkpoint(c.signal,()=>current(c));const op=opportunitySchema.parse(await api.catalog.getOpportunityById(h.opportunityId,c.signal));checkpoint(c.signal,()=>current(c));
      setInput(v=>({...v,opportunity:op,handoff:h,purpose:h.purpose,faculty:null,identityConfirmed:false,manual:{...v.manual,email:h.recipients[0]?.publicAddress||'',identityConfirmed:false}}));
      setNotice('已载入项目交接。请确认官方联系人姓名和邮箱。');
    }catch(e){if(current(c))report(e,'交接未载入，请检查文件格式或项目是否可用。');}finally{finish(c);}
  }
  const review=(p:Partial<DraftInput['projectReview']>)=>patch({projectReview:{...input.projectReview,...p}});
  const sources=[...(input.faculty?.sources||[]),...(input.opportunity?.sources||[])];
  return <div className="rs-outreach">
    <header className="or-header"><div><span className="or-eyebrow">RESEARCHSPACE / CONNECT</span><h1>科研联系邮件</h1><p>真实的背景，具体的兴趣，开启一次值得期待的交流。</p></div><span className="or-chip"><Mail size={14}/>仅生成草稿</span></header>
    <div className="or-status" role="status">{notice}</div>{failure&&<div role="alert" className="or-warning">{failure}</div>}
    <div className="or-layout"><div className="or-input-column"><fieldset disabled={busy} className="or-form-fieldset">
      <section className="or-card"><div className="or-section-title"><span>01</span><h2>联系谁</h2></div>
        {input.faculty?<div className="or-selected"><strong>{input.faculty.name}</strong><span>{input.faculty.institution}</span>{input.faculty.isDemo&&<b className="or-warning">演示数据 / 非真实导师</b>}<button type="button" className="or-link" onClick={()=>patch({faculty:null,identityConfirmed:false,facultyResearchConfirmed:false})}>改为手动填写</button></div>:<>
          <label className="or-field">导师姓名或机构称呼<input maxLength={100} value={input.manual.name} onChange={e=>manual({name:e.target.value})} placeholder="例如：导师姓名、项目办公室"/></label>
          <label className="or-field">所属学校或机构<input maxLength={150} value={input.manual.institution} onChange={e=>manual({institution:e.target.value})} placeholder="用于区分同名导师"/></label>
          <button type="button" className="or-button or-wide" onClick={()=>void research()}><Search size={15}/>查询导师与项目</button>
          <details className="or-manual"><summary>填写公开主页与补充资料</summary>
            <label className="or-field">公开主页<input type="url" maxLength={1000} value={input.manual.officialPage} onChange={e=>manual({officialPage:e.target.value})} placeholder="https://…"/></label>
            <label className="or-field">公开联系邮箱<input type="email" maxLength={254} value={input.manual.email} onChange={e=>manual({email:e.target.value})}/></label>
            <label className="or-field">公开研究介绍<textarea aria-label="公开研究介绍" maxLength={1800} value={input.manual.researchSummary} onChange={e=>manual({researchSummary:e.target.value})}/></label>
            <label className="or-check"><input type="checkbox" checked={input.manual.researchConfirmed} onChange={e=>patch({manual:{...input.manual,researchConfirmed:e.target.checked}})}/>我已根据该主页核对研究介绍，同意用于草稿</label>
          </details></>}
        {results&&(results.faculty.length>0||results.opportunities.length>0||results.links.length>0||results.pages.length>0)&&<div className="or-results">{results.faculty.map(f=><button type="button" key={f.id} onClick={()=>chooseFaculty(f)}><strong>{f.name}</strong><span>{f.institution}{f.isDemo?' · 演示数据':''}</span></button>)}{results.opportunities.map(o=><button type="button" key={o.id} onClick={()=>chooseOpportunity(o)}><strong>{o.title}</strong><span>项目线索 · {o.institution}{o.isDemo?' · 非真实项目':''}</span></button>)}
          {results.links.map(l=><p key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}<ArrowUpRight size={12}/></a><small>未核实的候选资料 · {l.snippet}</small></p>)}
          {results.pages.map(p=><details key={p.url}><summary>页面摘录：{p.title}</summary><p className="or-excerpt">{p.text}</p><a href={p.url} target="_blank" rel="noopener noreferrer">打开来源</a><small>查阅 {p.accessedAt} · 仅作待核对资料</small></details>)}
        </div>}
        <label className="or-check"><input type="checkbox" checked={input.faculty?input.identityConfirmed:input.manual.identityConfirmed} onChange={e=>input.faculty?patch({identityConfirmed:e.target.checked}):patch({manual:{...input.manual,identityConfirmed:e.target.checked}})}/>我已核对姓名、机构及主页，确认联系对象</label>
        {input.faculty&&<><p className="or-muted">{input.faculty.researchSummary}</p><label className="or-check"><input type="checkbox" checked={input.facultyResearchConfirmed} onChange={e=>patch({facultyResearchConfirmed:e.target.checked})}/>我已核对研究资料，同意在邮件中引用</label><button className="or-link" type="button" onClick={()=>api.navigation.go(api.navigation.facultyPath(input.faculty!.id))}>查看导师完整资料 ↗</button></>}
        {input.opportunity&&<div className="or-project"><div className="or-row"><h3>{input.opportunity.title}</h3><button type="button" aria-label="移除项目" className="or-link" onClick={()=>patch({opportunity:null,handoff:null})}><X size={16}/></button></div><p>招募：{opportunityStatusLabels[input.opportunity.status]} · 资格范围：{eligibilityLabels[input.opportunity.eligibility]}</p>{input.opportunity.isDemo&&<p className="or-warning">演示数据 / 非真实项目</p>}
          <button type="button" className="or-link" onClick={()=>api.navigation.go(api.navigation.opportunityPath(input.opportunity!.id))}>查看项目与官方申请方式 ↗</button>
          {input.opportunity.applicationUrl&&<a href={input.opportunity.applicationUrl} target="_blank" rel="noopener noreferrer">打开官方申请入口 ↗</a>}
          {input.handoff?<p><Check size={14}/>已绑定当前画像的项目交接</p>:<details open className="or-manual"><summary>核对官方联系规则</summary>
            <label className="or-field">用于核对的官方来源<select value={input.projectReview.officialSourceUrl} onChange={e=>review({officialSourceUrl:e.target.value,checked:false})}><option value="">请选择</option>{input.opportunity.sources.filter(s=>s.type==='official').map(s=><option key={s.id} value={s.url}>{s.title}</option>)}</select></label>
            <label className="or-field">官方指定联系邮箱<input type="email" value={input.projectReview.email} onChange={e=>review({email:e.target.value,checked:false})}/></label>
            <label className="or-check"><input type="checkbox" checked={input.projectReview.contactAllowed} onChange={e=>review({contactAllowed:e.target.checked})}/>官方允许以当前目的联系该邮箱，未要求仅通过系统办理</label>
            <label className="or-check"><input type="checkbox" checked={input.projectReview.eligible} onChange={e=>review({eligible:e.target.checked})}/>我已逐项核对，确认符合该项目当前申请资格</label>
            <label className="or-check"><input type="checkbox" checked={input.projectReview.checked} onChange={e=>review({checked:e.target.checked,purpose:e.target.checked?input.purpose:null})}/>以上依据来自所选官方来源，由我确认</label>
          </details>}
        </div>}
        <details className="or-manual"><summary>导入项目模块交接</summary><p className="or-muted">仅在本地读取单个项目的 JSON，须绑定当前账号与画像。</p><input type="file" accept=".json,application/json" aria-label="导入项目交接文件" onChange={e=>{const file=e.target.files?.[0];if(file)void importHandoff(file);e.target.value='';}}/></details>
        {sources.length>0&&<details className="or-manual"><summary>来源与查阅时间（{sources.length}）</summary><ul>{sources.map((s,i)=><li key={`${s.id}:${i}`}><a href={httpUrl(s.url)||undefined} target="_blank" rel="noopener noreferrer">{s.title}</a><small>{s.accessedAt}{s.type==='mock'?' · 演示来源':''}</small></li>)}</ul></details>}
      </section>
      <section className="or-card"><div className="or-section-title"><span>02</span><h2>确认采用的个人资料</h2></div><p className="or-muted">仅勾选的字段会用于邮件。学校可能来自初始默认值，请逐项确认。</p>
        {choices.map(c=><label className="or-fact-choice" key={c.id}><input type="checkbox" checked={input.selectedProfileIds.includes(c.id)} onChange={e=>patch({selectedProfileIds:e.target.checked?[...input.selectedProfileIds,c.id]:input.selectedProfileIds.filter(id=>id!==c.id)})}/><span><small>{c.label}</small>{c.text}</span></label>)}
        <button type="button" className="or-link" onClick={()=>api.navigation.go('/app/profile')}>编辑我的科研画像 ↗</button>
        <label className="or-field">用于生成的署名<input aria-label="用于生成的署名" maxLength={100} value={input.signature} onChange={e=>patch({signature:e.target.value})}/><small>可使用已确认的昵称，不代表学校身份认证。</small></label>
        <details className="or-manual"><summary>阅读经历与可提供材料（可选）</summary>
          <label className="or-field">实际看过的资料或论文标题<input maxLength={250} value={input.reading.title} onChange={e=>patch({reading:{...input.reading,title:e.target.value,confirmed:false}})}/></label>
          <label className="or-field">实际阅读层次<select value={input.reading.level} onChange={e=>patch({reading:{...input.reading,level:e.target.value as DraftInput['reading']['level'],confirmed:false}})}><option value="introduction">只看过介绍</option><option value="abstract">读过摘要</option><option value="full">通读全文</option><option value="reproduced">实际进行过复现</option></select></label>
          <label className="or-check"><input type="checkbox" checked={input.reading.confirmed} onChange={e=>patch({reading:{...input.reading,confirmed:e.target.checked}})}/>这是真实的阅读或复现经历</label>
          <label className="or-field">已准备好、可提供的材料（每行一项）<textarea aria-label="已准备好、可提供的材料（每行一项）" maxLength={900} value={input.materials.join('\n')} onChange={e=>patch({materials:e.target.value.split('\n')})} placeholder="例如：个人简历、课程项目链接"/></label><p className="or-muted">只记录材料名称；文件需在邮箱客户端自行添加。</p>
        </details>
      </section>
      <section className="or-card"><div className="or-section-title"><span>03</span><h2>表达方式</h2></div>
        <label className="or-field">联系目的<select value={input.purpose} onChange={e=>patch({purpose:e.target.value as Purpose})}>{Object.entries(purposeLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
        {input.purpose==='follow_up'&&<><label className="or-field">此前联系日期<input type="date" value={input.followUpDate} onChange={e=>patch({followUpDate:e.target.value,followUpConfirmed:false})}/></label><label className="or-check"><input type="checkbox" checked={input.followUpConfirmed} onChange={e=>patch({followUpConfirmed:e.target.checked})}/>我确实曾在该日期联系过对方</label></>}
        <div className="or-two"><label className="or-field">语气<select value={input.tone} onChange={e=>patch({tone:e.target.value as DraftInput['tone']})}><option value="formal">正式礼貌</option><option value="concise">直接简练</option></select></label><label className="or-field">长度<select value={input.length} onChange={e=>patch({length:e.target.value as DraftInput['length']})}><option value="standard">标准</option><option value="short">精简</option></select></label></div>
        <fieldset className="or-language-choice"><legend>生成语言</legend>{LANGUAGES.map(l=><label className="or-check" key={l}><input type="checkbox" checked={languages.includes(l)} onChange={e=>{setLanguages(v=>e.target.checked?[...v,l]:v.length>1?v.filter(x=>x!==l):v);setPending(null);}}/>{languageLabels[l]}</label>)}</fieldset>
        <p className="or-muted">同一份事实生成不同语言，无需重新查询。自由填写的内容在本地模板中保留原文。</p>
        <div className="or-actions"><button type="button" className="or-button or-primary" onClick={()=>void localGenerate()}>生成本地草稿</button><button type="button" className="or-button" disabled={api.ai.state==='unconfigured'} onClick={prepareAi}><Sparkles size={15}/>AI 辅助生成</button></div>
        {api.ai.state==='unconfigured'&&<p className="or-muted">AI 尚未配置。<button type="button" className="or-link" onClick={()=>api.navigation.go('/app/settings')}>查看连接设置</button></p>}
      </section>
    </fieldset></div>
    <div className="or-output-column">
      {busy&&<div className="or-working" role="status">正在处理…<button type="button" className="or-link" onClick={()=>{running.current?.abort();running.current=null;setBusy(false);setNotice('已取消，已有草稿保留。');}}>取消</button></div>}
      {documents.length>1&&<div className="or-tabs" role="tablist" aria-label="草稿语言">{documents.map(d=><button type="button" role="tab" aria-selected={d.id===activeId} key={d.id} className={d.id===activeId?'active':''} onClick={()=>setActiveId(d.id)}>{languageLabels[d.payload.language]}</button>)}</div>}
      <DraftEditor document={active} onChange={changeDoc} onSave={()=>void save()} onCopy={()=>void copy()} onDownload={download} saving={saving}/>
      {active&&<section className="or-card or-record"><h2>草稿记录</h2><label className="or-field">草稿名称<input maxLength={120} value={active.name} onChange={e=>changeDoc({...active,name:e.target.value})}/></label><label className="or-field">手动联系状态<select value={active.status} onChange={e=>changeDoc({...active,status:e.target.value as DraftDocument['status']})}><option value="draft">准备中</option><option value="sent">已发送（本人标记）</option><option value="replied">已回复（本人标记）</option><option value="closed">不再联系</option></select></label><p className="or-muted">修改后点击“保存草稿”。状态由你手动记录，系统没有发送或读取邮件。</p>{active.plan.profileUpdatedAt!==profile.updatedAt&&<p className="or-warning">此草稿依据旧版画像生成，请核对其中的个人资料。</p>}</section>}
      <DefaultPanel taskId={taskId} items={diagnostics}/>
      <section className="or-card or-saved"><div className="or-row"><h2>已保存的草稿</h2><span className="or-chip">{saved.length}</span></div>{!saved.length&&<p className="or-muted">保存后，可在当前账号中继续编辑。</p>}{saved.map(d=><div key={d.id} className="or-saved-row"><button type="button" className="or-saved-open" onClick={()=>{setDocuments([d]);setActiveId(d.id);setNotice('已打开保存的草稿。');}}><strong>{d.name}</strong><small>{languageLabels[d.payload.language]} · {d.updatedAt.slice(0,10)} · {({draft:'准备中',sent:'已发送（本人标记）',replied:'已回复（本人标记）',closed:'不再联系'})[d.status]}</small></button>{deleting===d.id?<div><button type="button" className="or-link or-danger" disabled={saving} onClick={()=>void remove(d.id)}>确认删除</button><button type="button" className="or-link" onClick={()=>setDeleting(null)}>取消</button></div>:<button type="button" className="or-link" onClick={()=>setDeleting(d.id)}>删除</button>}</div>)}</section>
    </div></div>
    {pending&&<ConsentDialog request={makeAiRequest(pending.plan,pending.languages)} onApprove={()=>void approvedAi()} onCancel={()=>setPending(null)}/>}
  </div>;
}
