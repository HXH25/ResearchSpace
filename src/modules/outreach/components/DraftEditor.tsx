import { Copy, Download, Save } from 'lucide-react';
import type { DraftDocument } from '../types';
import { languageLabels } from '../core/locales';

export function DraftEditor({document:doc,onChange,onSave,onCopy,onDownload,saving}:{document:DraftDocument|null;onChange:(d:DraftDocument)=>void;onSave:()=>void;onCopy:()=>void;onDownload:()=>void;saving:boolean}) {
  if(!doc)return <section className="or-empty"><div className="or-envelope">✉</div><span className="or-eyebrow">YOUR NEXT CONVERSATION</span><h2>从一封真实的邮件开始</h2><p>确认左侧资料，选择语言，生成后可在这里修改、保存或下载。</p><p className="or-muted">没有 AI 服务也可以使用完整的本地模板。</p></section>;
  const edit=(patch:Partial<DraftDocument['payload']>)=>onChange({...doc,payload:{...doc.payload,...patch},edited:true,updatedAt:new Date().toISOString()});
  return <section className="or-editor" aria-label="邮件编辑器">
    <div className="or-row"><div><span className="or-eyebrow">EMAIL DRAFT / {languageLabels[doc.payload.language]}</span><h2>把你的兴趣说具体</h2></div><span className="or-chip">{doc.mode==='template'?'本地模板':doc.mode==='ai-demo'?'AI 演示':'AI 草稿'}</span></div>
    {doc.plan.isDemo&&<p className="or-warning">演示数据 / 非真实导师或项目</p>}
    <p className="or-recipient">收件地址：{doc.plan.recipientEmail||'尚未核实，请在邮箱客户端填写'}</p>
    <label className="or-field">主题<input maxLength={180} value={doc.payload.subject} onChange={e=>edit({subject:e.target.value})}/></label>
    <label className="or-field">称呼<input maxLength={250} value={doc.payload.salutation} onChange={e=>edit({salutation:e.target.value})}/></label>
    <label className="or-field">正文<textarea aria-label="正文" className="or-email-body" maxLength={18000} value={doc.payload.paragraphs.map(p=>p.text).join('\n\n')} onChange={e=>edit({paragraphs:e.target.value.split(/\n\s*\n/).map(text=>({text,factIds:[]}))})}/></label>
    <div className="or-two"><label className="or-field">结束语<input maxLength={200} value={doc.payload.closing} onChange={e=>edit({closing:e.target.value})}/></label><label className="or-field">邮件署名<input maxLength={100} value={doc.payload.signature} onChange={e=>edit({signature:e.target.value})}/></label></div>
    {doc.edited&&<p className="or-warning">你已手动修改邮件；原生成时的事实检查不涵盖修改内容，请核对后使用。</p>}
    <div className="or-editor-footer"><span>生成的是草稿，邮件由你自行发送。</span><div className="or-actions"><button type="button" className="or-button" onClick={onCopy}><Copy size={15}/>复制邮件</button><button type="button" className="or-button" onClick={onDownload}><Download size={15}/>下载 .txt</button><button type="button" className="or-button or-primary" disabled={saving} onClick={onSave}><Save size={15}/>{saving?'保存中…':'保存草稿'}</button></div></div>
    <details className="or-audit"><summary>查看生成依据与待核对事项</summary><ul>{doc.plan.caveats.map((v,i)=><li key={i}>{v}</li>)}</ul><h3>采用的事实</h3><ul>{doc.plan.facts.map(f=><li key={f.id}><strong>{f.owner==='student'?'学生确认':f.owner==='recipient'?'导师资料':'项目资料'}：</strong>{f.text}{f.readingLevel?`（阅读层次：${f.readingLevel}）`:''}<small>来源编号：{f.sourceIds.join('，')||'本人确认'}</small></li>)}</ul><h3>来源与查阅时间</h3><ul>{doc.plan.sources.map((s,i)=><li key={`${s.id}:${i}`}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><small>{s.id} · 查阅 {s.accessedAt}{s.publishedAt?` · 发布 ${s.publishedAt}`:''}{s.type==='mock'?' · 演示来源':''}</small></li>)}</ul><p>材料建议：{doc.plan.attachmentSuggestions.join('；')}。下载的文本不会附加文件。</p></details>
  </section>;
}
