import React, { useMemo, useState } from 'react';
import { researchClient, type ResearchProfile, type ResearchProject } from './client';

/** Adapt your real HostApi outside this component. Never send a profile without user action. */
export default function ResearchProjectsPanel({profile,base='/api',onSave}: {
  profile: ResearchProfile; base?: string; onSave?: (project: ResearchProject) => void;
}) {
  const client=useMemo(()=>researchClient(base),[base]);
  const [q,setQ]=useState(''), [items,setItems]=useState<ResearchProject[]>([]);
  const [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const [detail,setDetail]=useState<ResearchProject|null>(null);
  const [page,setPage]=useState(1), [total,setTotal]=useState(0);
  const [mode,setMode]=useState<'search'|'recommend'>('search');
  async function load(nextMode: 'search'|'recommend', nextPage=1) {
    setBusy(true); setError('');
    try {
      const filters={q,page:nextPage,page_size:12,hide_conflicts:true};
      const data=nextMode==='recommend'?await client.recommend(profile,filters):await client.search(filters);
      setMode(nextMode);setPage(nextPage);setItems(data.items);setTotal(data.total);
    } catch(e){setError(e instanceof Error?e.message:'加载失败')} finally {setBusy(false)}
  }
  const safeLink=(url:string)=>/^https?:\/\//i.test(url)?url:undefined;
  return <section aria-label="科研项目">
    <h2>科研项目发现</h2>
    <form onSubmit={e=>{e.preventDefault();void load('search')}}>
      <label>研究关键词 <input value={q} onChange={e=>setQ(e.target.value)} /></label>
      <button disabled={busy}>搜索</button>
      <button type="button" disabled={busy} onClick={()=>void load('recommend')}>使用当前画像推荐</button>
    </form>
    <p>点击推荐会向本系统后端发送当前画像；不发送给外部 AI，分数不代表录取概率。</p>
    {error&&<p role="alert">{error}</p>}
    <p>{busy?'加载中…':`${total} 条结果`}</p>
    {items.map(p=><article key={p.id}>
      <h3>{p.title}</h3><p>{p.institution} · {p.region}</p><p>{p.description}</p>
      {p.match&&<p>适配参考 {p.match.score}/100 · {p.match.reasons.join('；')}</p>}
      <button onClick={()=>setDetail(p)}>查看详情</button>
      {onSave&&<button onClick={()=>onSave(p)}>加入宿主候选清单</button>}
    </article>)}
    <nav aria-label="分页"><button disabled={busy||page<=1} onClick={()=>void load(mode,page-1)}>上一页</button>
    <span> {page} / {Math.max(1,Math.ceil(total/12))} </span>
    <button disabled={busy||page*12>=total} onClick={()=>void load(mode,page+1)}>下一页</button></nav>
    {detail&&<section role="region" aria-label="项目详情"><button onClick={()=>setDetail(null)}>关闭</button>
      <h3>{detail.title}</h3><dl>{[['研究内容',detail.description],['研究周期',detail.period_text],['导师',detail.mentors.join('、')],['团队',detail.team],['资格',detail.eligibility_text],['申请方式',detail.application_method]].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v||'未公布 / 待核实'}</dd></React.Fragment>)}</dl>
      <ul>{[...(detail.match?.unknowns||[]),...detail.warnings].map((x,i)=><li key={i}>{x}</li>)}</ul>
      <a href={safeLink(detail.source_url)} target="_blank" rel="noopener noreferrer">官方来源</a>
    </section>}
  </section>;
}
