import type { HostCatalog } from '@/sdk/contracts';
import type { Diagnostic, FetchPort, ResearchPort, SearchHit, SearchPort } from '../types';
import { checkpoint, clean, httpUrl } from '../core/safety';
import { facultySchema, opportunitySchema } from '../core/schemas';

export function createResearcher(catalog:HostCatalog,search?:SearchPort,fetcher?:FetchPort):ResearchPort {
  return {async research(query,signal) {
    const name=clean(query.name,100);const institution=clean(query.institution,150);
    const diagnostics:Diagnostic[]=[];
    const calls=await Promise.allSettled([
      catalog.searchFaculty({text:name,institution:institution||undefined,limit:15},signal),
      catalog.searchOpportunities({text:name,institution:institution||undefined,limit:10},signal),
    ]);checkpoint(signal);
    const faculty=[];const opportunities=[];
    if(calls[0].status==='fulfilled') for(const value of calls[0].value) {const p=facultySchema.safeParse(value);if(p.success)faculty.push(p.data);else diagnostics.push({code:'FACULTY_INVALID',message:'部分导师记录缺少必要字段或来源，已跳过。',level:'warning'});}
    if(calls[1].status==='fulfilled') for(const value of calls[1].value) {const p=opportunitySchema.safeParse(value);if(p.success)opportunities.push(p.data);else diagnostics.push({code:'OPPORTUNITY_INVALID',message:'部分项目记录格式不完整，已跳过。',level:'warning'});}
    if(calls.some(r=>r.status==='rejected')) diagnostics.push({code:'CATALOG_PARTIAL',message:'部分目录查询未完成，已保留成功结果。',level:'warning'});
    if(!faculty.length) diagnostics.push({code:'CATALOG_EMPTY',message:'导师目录未返回记录（可能尚未安装、无匹配或查询失败）；可填写公开主页并手动核对。',level:'info'});
    const links:SearchHit[]=[];
    if(search && name) {
      const queries=[`${name} ${institution} 官方 研究 主页`,`${name} ${institution} research laboratory faculty`];
      const results=await Promise.allSettled(queries.map(q=>search.search(q,signal)));checkpoint(signal);
      for(const r of results) {
        if(r.status==='fulfilled') for(const hit of r.value.slice(0,8)) {
          const u=httpUrl(hit.url);if(u&&!links.some(l=>l.url===u))links.push({url:u,title:clean(hit.title,200),snippet:clean(hit.snippet,700)});
        } else diagnostics.push({code:'SEARCH_PARTIAL',message:'一项公开搜索未完成，其他结果仍可使用。',level:'warning'});
      }
    }
    const pages=[];
    const urls=[query.homepage,...links.map(l=>l.url)].filter((u):u is string=>!!u&&!!httpUrl(u));
    if(fetcher) {
      const results=await Promise.allSettled([...new Set(urls)].slice(0,3).map(u=>fetcher.fetch(u,signal)));checkpoint(signal);
      for(const r of results) {
        if(r.status==='fulfilled' && httpUrl(r.value.url) && Number.isFinite(Date.parse(r.value.accessedAt))) pages.push({...r.value,title:clean(r.value.title,200),text:clean(r.value.text,10000)});
        else diagnostics.push({code:'FETCH_PARTIAL',message:'部分页面暂时无法读取，可打开原始链接核对。',level:'warning'});
      }
    }
    if(links.length||pages.length) diagnostics.push({code:'IDENTITY_REVIEW',message:'公开搜索仅提供候选资料；请核对姓名、机构和主页，不能自动合并同名导师。',level:'info'});
    return {faculty,opportunities,links:links.slice(0,12),pages,diagnostics};
  }};
}
