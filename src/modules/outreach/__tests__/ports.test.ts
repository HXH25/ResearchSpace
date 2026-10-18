import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, faculty, input } from './fixtures';
import { generateAi, makeAiRequest } from '../core/ai';
import { buildPlan } from '../core/plan';
import { templateDraft } from '../core/template';
import { createDraftRepository } from '../core/storage';
import { makeDocument } from '../core/service';
import { createResearcher } from '../providers/research';
import { createJsonResearchProxy } from '../providers/jsonResearchProxy';

afterEach(()=>vi.unstubAllGlobals());
describe('AI port',()=>{
  function setup(){const a=api();a.ai={state:'ready',generate:vi.fn()};const plan=buildPlan(input());const response={text:JSON.stringify({drafts:[templateDraft(plan,'en')]}),mode:'live' as const,createdAt:new Date().toISOString()};vi.mocked(a.ai.generate).mockResolvedValue(response);return {a,plan,response};}
  it('cannot call remote AI without per-request consent',async()=>{const {a,plan}=setup();await expect(generateAi({ai:a.ai,plan,languages:['en'],consent:false})).rejects.toThrow(/同意/);expect(a.ai.generate).not.toHaveBeenCalled();});
  it('previews only selected data and uses the host AI port',async()=>{
    const {a}=setup();const i=input();i.selectedProfileIds=[];const plan=buildPlan(i);const request=makeAiRequest(plan,['en']);expect(request.input).not.toContain(i.profile.userId);expect(request.input).not.toContain('course project');
    vi.mocked(a.ai.generate).mockResolvedValue({text:JSON.stringify({drafts:[templateDraft(plan,'en')]}),mode:'live',createdAt:new Date().toISOString()});
    await generateAi({ai:a.ai,plan,languages:['en'],consent:true});expect(a.ai.generate).toHaveBeenCalledWith({...request,personalDataConsent:true},expect.any(AbortSignal));
  });
  it('repairs once, and never echoes failed model text',async()=>{
    const {a,plan,response}=setup();vi.mocked(a.ai.generate).mockResolvedValueOnce({...response,text:'SECRET MODEL TEXT'}).mockResolvedValueOnce(response);
    const result=await generateAi({ai:a.ai,plan,languages:['en'],consent:true});expect(result.repaired).toBe(true);expect(a.ai.generate).toHaveBeenCalledTimes(2);expect(vi.mocked(a.ai.generate).mock.calls[1][0].input).not.toContain('SECRET MODEL TEXT');
  });
  it('stops after two invalid outputs and never retries a network error',async()=>{
    const {a,plan,response}=setup();vi.mocked(a.ai.generate).mockResolvedValue({...response,text:'invalid'});
    await expect(generateAi({ai:a.ai,plan,languages:['en'],consent:true})).rejects.toThrow();expect(a.ai.generate).toHaveBeenCalledTimes(2);
    vi.mocked(a.ai.generate).mockClear().mockRejectedValue(new Error('429 secret-token'));
    await expect(generateAi({ai:a.ai,plan,languages:['en'],consent:true})).rejects.toThrow();expect(a.ai.generate).toHaveBeenCalledTimes(1);
  });
  it('discards delayed responses after cancellation or account change',async()=>{
    const {a,plan,response}=setup();const c=new AbortController();vi.mocked(a.ai.generate).mockImplementation(async()=>{c.abort();return response;});
    await expect(generateAi({ai:a.ai,plan,languages:['en'],consent:true,signal:c.signal})).rejects.toThrow(/取消/);
    await expect(generateAi({ai:a.ai,plan,languages:['en'],consent:true,isCurrent:()=>false})).rejects.toThrow(/变化/);
  });
  it('times out a provider that ignores cancellation, without an infinite retry',async()=>{
    vi.useFakeTimers();const {a,plan}=setup();vi.mocked(a.ai.generate).mockImplementation(()=>new Promise(()=>undefined));
    try {const promise=generateAi({ai:a.ai,plan,languages:['en'],consent:true});const assertion=expect(promise).rejects.toThrow(/45 秒/);await vi.advanceTimersByTimeAsync(45000);await assertion;expect(a.ai.generate).toHaveBeenCalledTimes(1);}finally{vi.useRealTimers();}
  });
});
describe('private draft repository',()=>{
  it('saves, renames, sets manually reported status and removes',async()=>{
    const a=api(),plan=buildPlan(input()),repo=createDraftRepository(a.storage,plan.ownerUserId);const d=makeDocument(plan,templateDraft(plan,'en'),'template');
    await repo.save(d);expect((await repo.list()).length).toBe(1);await repo.save({...d,name:'Renamed',status:'sent'});expect((await repo.list())[0].status).toBe('sent');await repo.remove(d.id);expect(await repo.list()).toEqual([]);
  });
  it('refuses ownership mismatch even if a broken host returns another account data',async()=>{
    const a=api(),plan=buildPlan(input());const d=makeDocument(plan,templateDraft(plan,'en'),'template');const repo=createDraftRepository(a.storage,'other');await expect(repo.save(d)).rejects.toThrow(/账号/);
    await createDraftRepository(a.storage,plan.ownerUserId).save(d);await expect(repo.list()).rejects.toThrow(/账号/);
  });
  it('preserves corrupt stored data and serializes concurrent saves',async()=>{
    const a=api(),plan=buildPlan(input()),repo=createDraftRepository(a.storage,plan.ownerUserId);
    await Promise.all(['en','zh-CN'].map(l=>repo.save(makeDocument(plan,templateDraft(plan,l as 'en'|'zh-CN'),'template'))));expect(await repo.list()).toHaveLength(2);
    await a.storage.set('drafts:v2',{version:999,important:'preserve'});await expect(repo.save(makeDocument(plan,templateDraft(plan,'en'),'template'))).rejects.toThrow(/停止覆盖/);expect(await a.storage.get('drafts:v2')).toEqual({version:999,important:'preserve'});
  });
});
describe('replaceable public research adapters',()=>{
  it('keeps catalog results on partial web failure, never sends student data to search',async()=>{
    const a=api();vi.mocked(a.catalog.searchFaculty).mockResolvedValue([faculty()]);const search={search:vi.fn().mockResolvedValueOnce([{title:'Candidate',url:'https://example.org/a',snippet:'unverified'}]).mockRejectedValueOnce(new Error('secret'))};
    const fetcher={fetch:vi.fn().mockRejectedValue(new Error('blocked'))};const r=await createResearcher(a.catalog,search,fetcher).research({name:'Researcher',institution:'Example University'});
    expect(r.faculty).toHaveLength(1);expect(r.links).toHaveLength(1);expect(r.diagnostics.map(d=>d.code)).toContain('FETCH_PARTIAL');expect(JSON.stringify(r)).not.toContain('secret');expect(search.search).toHaveBeenCalledTimes(2);expect(JSON.stringify(search.search.mock.calls)).not.toContain('Sample Student');
  });
  it('does not merge same-name faculty and rejects unsafe URLs',async()=>{
    const a=api();vi.mocked(a.catalog.searchFaculty).mockResolvedValue([faculty(),{...faculty(),id:'different',institution:'Other University'}]);const r=await createResearcher(a.catalog,{search:async()=>[{title:'bad',url:'javascript:alert(1)',snippet:'bad'}]}).research({name:'Example',institution:''});expect(r.faculty).toHaveLength(2);expect(r.links).toHaveLength(0);
  });
  it('uses a validated same-origin JSON gateway with no student profile',async()=>{
    const request=vi.fn(async(_url:string,_options?:RequestInit)=>new Response(JSON.stringify({results:[{title:'Example',url:'https://example.org',snippet:'candidate'}]}),{status:200}));vi.stubGlobal('fetch',request);
    const proxy=createJsonResearchProxy('/api/public-research');expect(await proxy.search.search('Researcher')).toHaveLength(1);expect(JSON.parse(request.mock.calls[0][1]?.body as string)).toEqual({operation:'search',query:'Researcher',limit:8});
    expect(()=>createJsonResearchProxy('https://external.example/')).toThrow();expect(()=>createJsonResearchProxy('/api/../other')).toThrow();
  });
});
