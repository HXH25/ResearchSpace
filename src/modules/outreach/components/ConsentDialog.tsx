import { useEffect, useRef, useState } from 'react';
import type { AiGenerateRequest } from '@/sdk/contracts';

export function ConsentDialog({request,onApprove,onCancel}:{request:AiGenerateRequest;onApprove:()=>void;onCancel:()=>void}) {
  const [agreed,setAgreed]=useState(false);const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>previous?.focus();},[]);
  return <div className="or-overlay"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="or-consent-title" className="or-consent" onKeyDown={e=>{
    if(e.key==='Escape'){e.preventDefault();onCancel();}
    if(e.key==='Tab') {
      const elements=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,[tabindex="0"]')||[]);
      const first=elements[0],last=elements[elements.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  }}>
    <div className="or-row"><h2 id="or-consent-title">确认本次 AI 使用资料</h2><button type="button" className="or-link" onClick={onCancel} aria-label="关闭授权窗口">关闭</button></div>
    <p>下方是将交给当前 AI 服务的完整资料。只包括你勾选的事实、署名、收件人及公开来源。模型不会收到完整画像或其他草稿。</p>
    <p>若格式校验失败，最多使用同一份资料再请求一次，并附带校验代码。之后仍需你检查邮件事实与译文。</p>
    <pre tabIndex={0} aria-label="发送资料完整预览">{JSON.stringify({...request,personalDataConsent:true},null,2)}</pre>
    <label className="or-check"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>我同意本次将以上资料发送给已配置的 AI 服务</label>
    <div className="or-actions"><button type="button" className="or-button" onClick={onCancel}>返回编辑</button><button type="button" className="or-button or-primary" disabled={!agreed} onClick={onApprove}>同意并生成</button></div>
  </div></div>;
}
