import { useId, useState } from 'react';
import type { Diagnostic } from '../types';

/** UI only: no search, generation or private storage belongs in this component. */
export function DefaultPanel({taskId,items}:{taskId:string;items:Diagnostic[]}) {
  const id=useId();const [openedTask,setOpenedTask]=useState<string|null>(null);
  if(!items.length)return null;
  const open=openedTask===taskId;
  return <section className="or-diagnostics" aria-label="查询诊断">
    <button type="button" className="or-link" aria-expanded={open} aria-controls={id} onClick={()=>setOpenedTask(open?null:taskId)}>查询详情（{items.length}）{open?' −':' ＋'}</button>
    {open&&<ul id={id}>{items.map((d,i)=><li key={`${d.code}:${i}`}><span className={`or-dot or-${d.level}`}/><span>{d.message}</span></li>)}</ul>}
  </section>;
}
