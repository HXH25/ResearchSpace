import { z } from 'zod';
import type { FetchPort, SearchPort } from '../types';
import { fail, httpUrl } from '../core/safety';

/** Optional public-data gateway. API credentials and web retrieval stay on the
 * trusted server; the frozen HostApi and its AI provider remain unchanged. */
export function createJsonResearchProxy(endpoint:string):{search:SearchPort;fetch:FetchPort} {
  if(!endpoint.startsWith('/')||endpoint.startsWith('//')||/[\\\r\n#?]/.test(endpoint)) fail('PROXY_CONFIG','公开检索代理应使用同源绝对路径。');
  const checked=new URL(endpoint,'https://researchspace.invalid');
  if(checked.pathname!==endpoint) fail('PROXY_CONFIG','公开检索代理路径不能包含跳转片段。');
  async function request(body:unknown,signal?:AbortSignal) {
    const controller=new AbortController();const abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
    const timer=setTimeout(abort,15000);
    try {
      const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      if(!response.ok) fail('RESEARCH_NETWORK','公开检索服务暂时不可用。');
      const raw=await response.text();if(raw.length>180000)fail('RESEARCH_SIZE','检索服务返回的数据过大。');
      return JSON.parse(raw) as unknown;
    } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  const publicUrl=z.string().refine(v=>!!httpUrl(v));
  return {
    search:{async search(query,signal){const value=await request({operation:'search',query:query.slice(0,400),limit:8},signal);return z.object({results:z.array(z.object({title:z.string().max(500),url:publicUrl,snippet:z.string().max(5000)})).max(20)}).parse(value).results;}},
    fetch:{async fetch(url,signal){if(!httpUrl(url))fail('FETCH_URL','页面链接无效。');return z.object({url:publicUrl,title:z.string().max(500),text:z.string().max(60000),accessedAt:z.string()}).parse(await request({operation:'fetch',url},signal));}},
  };
}
