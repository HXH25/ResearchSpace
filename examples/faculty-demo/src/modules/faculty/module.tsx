/**
 * Optional installation smoke-test only.
 * This is a fabricated faculty profile, not an actual educator or opening.
 * Copy this directory into src/modules/faculty to try plug-and-play discovery.
 */
import type { FacultyRecord, FacultySearchQuery, ModulePageProps, ResearchModule } from '@/sdk/contracts';
import { CONTRACT_VERSION } from '@/sdk/contracts';

const now = '2026-10-18T00:00:00.000Z';
const facultyRecord: FacultyRecord = {
  id:'faculty:demo:fictional',
  name:'演示导师（虚构）',
  institution:'示例大学（虚构）',
  department:'演示研究中心',
  researchAreas:['ai-computing'],
  researchSummary:'这是用于测试模块装配和跨模块数据读取的虚构资料，不是真实导师。',
  recruitmentStatus:'unknown',
  lastCheckedAt:now,
  sources:[],
  isDemo:true,
};

function FacultyDemo({profile,api}:ModulePageProps) {
  return <div style={{maxWidth:820,margin:'0 auto'}}>
    <h1 style={{fontSize:32,marginBottom:14}}>导师探索 · 模块联调示例</h1>
    <p>你好，{profile.displayName}。这个页面由可插拔的 faculty 模块提供，而非宿主页面。</p>
    <div role="status" style={{background:'#fff3da',padding:16,borderRadius:12,margin:'24px 0'}}>
      演示数据 / 虚构导师 / 非真实招募项目
    </div>
    <h2 style={{fontSize:24,marginBottom:8}}>{facultyRecord.name}</h2>
    <p>{facultyRecord.researchSummary}</p>
    <p style={{margin:'16px 0'}}>招募状态：未知；请勿据此作出真实科研申请决定。</p>
    <button className="btn btn-primary" onClick={()=>api.navigation.go('/app/outreach?facultyId='+encodeURIComponent(facultyRecord.id))}>
      打开联系邮件插槽
    </button>
  </div>;
}

const matches=(query:FacultySearchQuery)=>!query.text ||
  `${facultyRecord.name} ${facultyRecord.researchSummary}`.toLowerCase().includes(query.text.toLowerCase());

const researchModule:ResearchModule = {
  contractVersion:CONTRACT_VERSION,
  id:'faculty',
  title:'导师探索（演示）',
  summary:'虚构数据，验证模块注册、跨模块查询和画像注入',
  icon:'graduation-cap',
  Root:FacultyDemo,
  providers:{
    faculty:{
      async search(query) {return matches(query)?[facultyRecord].slice(0,query.limit??100):[];},
      async getById(id) {return id===facultyRecord.id?facultyRecord:null;},
    },
  },
};
export default researchModule;
