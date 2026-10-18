import { z } from 'zod';
import type { DraftPayload, EmailPlan, Language } from '../types';
import { payloadSchema } from './schemas';
import { fail } from './safety';

// A bounded JSON reader rejects duplicate keys rather than accepting a hidden,
// overwritten field. It never evaluates model text or renders HTML.
export function strictJson(raw: string): unknown {
  if (raw.length > 120000) fail('AI_JSON','AI 输出过长，已拒绝。');
  let at=0;let nodes=0;
  const ws=()=>{while (/[ \t\r\n]/.test(raw[at]||'') && at<raw.length) at++;};
  const string=():string=>{
    const begin=at++;
    while (at<raw.length) {if (raw[at]==='\\') {at+=2;continue;} if (raw[at++]==='"') return JSON.parse(raw.slice(begin,at)) as string;}
    throw new Error('string');
  };
  const value=(depth=0):unknown=>{
    if (++nodes>12000 || depth>16) throw new Error('bounds');ws();
    if (raw[at]==='"') return string();
    if (raw[at]==='{') {
      at++;ws();const obj:Record<string,unknown>=Object.create(null);const seen=new Set<string>();
      if(raw[at]==='}') {at++;return obj;}
      for (;;) {
        ws();if(raw[at]!=='"') throw new Error('key');const key=string();
        if(seen.has(key)||['__proto__','constructor','prototype'].includes(key)) throw new Error('key');seen.add(key);ws();
        if(raw[at++]!==':') throw new Error('colon');obj[key]=value(depth+1);ws();
        const end=raw[at++];if(end==='}') return obj;if(end!==',') throw new Error('object');
      }
    }
    if (raw[at]==='[') {at++;ws();const a:unknown[]=[];if(raw[at]===']'){at++;return a;}for(;;){a.push(value(depth+1));ws();const end=raw[at++];if(end===']')return a;if(end!==',')throw new Error('array');}}
    const match=raw.slice(at).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if(!match)throw new Error('literal');at+=match[0].length;const v:unknown=JSON.parse(match[0]);if(typeof v==='number'&&!Number.isFinite(v))throw new Error('number');return v;
  };
  try {const result=value();ws();if(at!==raw.length) throw new Error('trailing');return result;} catch {return fail('AI_JSON','AI 未返回规范 JSON，草稿未被替换。');}
}
const numbers=(v:string)=>new Set(v.match(/\d+(?:\.\d+)?/g)||[]);
function readingStrength(t:string):number {
  if (/我(?:曾|已|确实|成功)*(?:复现)|I (?:have |had |previously )*(?:reproduced|worked on reproducing)|Reproduktion|reproduction de|再現に取り組/i.test(t)) return 3;
  if (/全文|通读|精读|full paper|full article|vollständige|article complet|論文全文/i.test(t)) return 2;
  if (/读(?:了|过)?[^。\n]*(?:摘要)|read[^.\n]*abstract|Zusammenfassung|lu le résumé|要旨を読み/i.test(t)) return 1;
  if (/我(?:曾|已|认真|仔细)*(?:阅读|读过|研读)|I (?:have |had |carefully |previously )*(?:read|studied)\b/i.test(t)) return 2;
  return 0;
}
export function validateDrafts(raw:string, plan:EmailPlan, languages:Language[]):DraftPayload[] {
  const parsed=z.object({drafts:z.array(payloadSchema).min(1).max(5)}).strict().safeParse(strictJson(raw));
  if(!parsed.success) fail('AI_SCHEMA','AI 返回的字段或长度不符合邮件结构要求。');
  const drafts=parsed.data.drafts;
  if(drafts.length!==languages.length || new Set(drafts.map(d=>d.language)).size!==languages.length || drafts.some(d=>!languages.includes(d.language))) fail('AI_LANGUAGE','AI 返回的语言与本次选择不一致。');
  const allowed=new Map(plan.facts.map(f=>[f.id,f]));
  const supported=plan.facts.map(f=>f.text+' '+f.english).join(' ')+' '+plan.recipientName+' '+plan.recipientNameEnglish;
  const knownNumbers=numbers(supported);
  for(const d of drafts) {
    if(d.signature!==plan.signature) fail('AI_SIGNATURE','AI 改动了署名，草稿已拒绝。');
    if(!d.salutation.includes(d.language==='en'?plan.recipientNameEnglish:plan.recipientName)) fail('AI_RECIPIENT','AI 改动了收件人称呼。');
    const text=[d.subject,d.salutation,...d.paragraphs.map(p=>p.text),d.closing,d.signature].join('\n');
    if(text.length>(plan.length==='short'?6500:14000)) fail('AI_LENGTH','AI 邮件超过选择的长度限制。');
    if(/<\s*\/?\s*[a-z!][^>]*>|\u0000/i.test(text)) fail('AI_HTML','邮件仅接受纯文本。');
    if(/(?:已|随信|随函)(?:经)?(?:附|附上)|\b(?:attached|enclosed|beigefügt|ci[- ]joint)\b|添付しました/i.test(text)) fail('AI_ATTACHMENT','本工具未附加或发送文件，不能声称材料已经附上。');
    if(/(?:您|贵组|贵团队)(?:目前|现在|正在)?(?:正在招|在招|有名额)|you are (?:currently )?(?:recruiting|hiring)|your (?:group|lab) (?:is|has) (?:recruiting|open positions)/i.test(text)) fail('AI_RECRUITMENT','草稿不能自行断言导师正在招生。');
    if(Array.from(numbers(text)).some(n=>!knownNumbers.has(n))) fail('AI_NUMBER','邮件含有输入事实中不存在的数值。');
    const emails=text.match(/[^\s<>]+@[^\s<>]+\.[a-z]+/gi)||[];
    if(emails.some(v=>v.replace(/[.,;]$/,'')!==plan.recipientEmail && !supported.includes(v))) fail('AI_CONTACT','AI 添加了未提供的邮箱。');
    if(/GPA|获奖|发表了|published (?:a |\d)|won (?:an? |the )/i.test(text) && !/GPA|获奖|发表|published|won /i.test(supported)) fail('AI_ACHIEVEMENT','AI 添加了未确认的成绩、奖项或论文经历。');
    for(const p of d.paragraphs) {
      if(p.factIds.some(id=>!allowed.has(id))) fail('AI_REFERENCE','AI 使用了不存在的事实编号。');
      const cited=p.factIds.map(id=>allowed.get(id)!);
      const level=Math.max(0,...cited.filter(f=>f.kind==='reading').map(f=>({introduction:0,abstract:1,full:2,reproduced:3}[f.readingLevel||'introduction'])));
      if(readingStrength(p.text)>level) fail('AI_READING','AI 提高了你实际确认的阅读或复现层次。');
    }
  }
  return languages.map(language=>drafts.find(d=>d.language===language)!);
}
