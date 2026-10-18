import { z } from 'zod';
import type { ScopedUserStorage } from '@/sdk/contracts';
import type { DraftDocument, DraftRepository } from '../types';
import { documentSchema } from './schemas';
import { fail } from './safety';

const KEY='drafts:v2';
const collection=z.object({version:z.literal(2),drafts:z.array(documentSchema).max(200)}).strict();
export function createDraftRepository(storage:ScopedUserStorage,ownerUserId:string):DraftRepository {
  let queue=Promise.resolve();
  async function read():Promise<DraftDocument[]> {
    const raw=await storage.get<unknown>(KEY);if(raw===null)return [];
    const parsed=collection.safeParse(raw);
    if(!parsed.success) fail('STORAGE_FORMAT','现有草稿数据格式不兼容，已停止覆盖。请先在账号设置中导出备份。');
    if(parsed.data.drafts.some(d=>d.ownerUserId!==ownerUserId||d.plan.ownerUserId!==ownerUserId)) fail('STORAGE_OWNER','草稿所属账号不一致，已停止读取与覆盖。');
    return parsed.data.drafts;
  }
  function serial(work:()=>Promise<void>):Promise<void> {
    const next=queue.then(async()=>{
      if(typeof navigator!=='undefined'&&navigator.locks) await navigator.locks.request(`researchspace:outreach:${ownerUserId}`,work);
      else await work();
    });
    queue=next.catch(()=>undefined);return next;
  }
  return {
    async list(){await queue;return (await read()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
    save(draft){return serial(async()=>{
      const checked=documentSchema.parse(draft);
      if(checked.ownerUserId!==ownerUserId||checked.plan.ownerUserId!==ownerUserId) fail('STORAGE_OWNER','无法把其他账号的草稿写入当前账号。');
      const previous=await read();const updated=[checked,...previous.filter(d=>d.id!==checked.id)];
      if(updated.length>200) fail('STORAGE_FULL','已保存 200 封草稿，请导出并删除不再需要的内容。');
      await storage.set(KEY,{version:2,drafts:updated});
    });},
    remove(id){return serial(async()=>{const previous=await read();await storage.set(KEY,{version:2,drafts:previous.filter(d=>d.id!==id)});});},
  };
}
