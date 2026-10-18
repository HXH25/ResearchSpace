// All identities, addresses and project claims in this file are synthetic.
import { vi } from 'vitest';
import type { FacultyRecord, HostApi, OpportunityRecord, StudentProfile } from '@/sdk/contracts';
import type { DraftInput, Handoff } from '../types';
import { profileChoices } from '../core/profile';

export function profile(id='test-user'):StudentProfile {
  return {schemaVersion:1,userId:id,displayName:'Sample Student',institution:'Example University',department:'Computer Science',undergraduateYear:'year2',goals:['explore_research'],researchAreas:['ai-computing'],interestKeywords:['machine learning'],skills:['programming'],skillEvidence:[{skill:'programming',description:'Completed a course project on image classification.'}],experience:'course_projects',workPreferences:['coding'],guidancePreference:'structured',weeklyHours:0,availability:'summer',preferredLanguages:['zh','en'],updatedAt:new Date().toISOString()};
}
export function faculty():FacultyRecord {
  return {id:'faculty:test',name:'示例导师',nameEnglish:'Example Researcher',institution:'Example University',officialPage:'https://example.org/faculty',publiclyListedContactEmail:'research@example.org',researchAreas:['ai-computing'],researchSummary:'Research on visual representation learning.',recruitmentStatus:'unknown',lastCheckedAt:new Date().toISOString(),sources:[{id:'faculty-source',title:'Synthetic official source for tests',url:'https://example.org/faculty',type:'official',accessedAt:new Date().toISOString()}],isDemo:false};
}
export function opportunity():OpportunityRecord {
  return {id:'opportunity:test',title:'Test Research Project',institution:'Example University',countryOrRegion:'TEST',type:'srt',researchAreas:['ai-computing'],summary:'Synthetic project.',eligibility:'open_to_all',status:'open_confirmed',statusVerifiedAt:new Date().toISOString(),lastCheckedAt:new Date().toISOString(),applicationUrl:'https://example.org/application',linkedFacultyIds:['faculty:test'],isDemo:false,sources:[{id:'project-source',title:'Synthetic project source',url:'https://example.org/project',type:'official',accessedAt:new Date().toISOString()}]};
}
export function input():DraftInput {
  const p=profile();return {profile:p,selectedProfileIds:profileChoices(p).map(c=>c.id),faculty:faculty(),manual:{name:'示例导师',institution:'Example University',email:'research@example.org',officialPage:'https://example.org/faculty',researchSummary:'Research on visual representation learning.',identityConfirmed:true,researchConfirmed:true},opportunity:null,handoff:null,projectReview:{contactAllowed:false,eligible:false,officialSourceUrl:'',email:'',checked:false,purpose:null},signature:p.displayName,purpose:'research_enquiry',tone:'formal',length:'standard',reading:{title:'',level:'introduction',confirmed:false},materials:[],followUpDate:'',followUpConfirmed:false,identityConfirmed:true,facultyResearchConfirmed:true};
}
export function handoff(i:DraftInput):Handoff {
  return {ownerUserId:i.profile.userId,profileUpdatedAt:i.profile.updatedAt,opportunityId:'opportunity:test',requestedAt:new Date().toISOString(),purpose:'application',qualification:'eligible',decision:'allowed',policy:'specified_contacts_only',permittedRouteIds:['route-email'],allowedApplicationRouteIds:['route-email'],recipients:[{routeId:'route-email',personId:'faculty:test',role:'faculty',publicAddress:'research@example.org',evidenceIds:['project-source']}],rules:[],sources:opportunity().sources};
}
export function api():HostApi {
  const values=new Map<string,unknown>();
  return {catalog:{searchFaculty:vi.fn(async()=>[]),getFacultyById:vi.fn(async()=>null),searchOpportunities:vi.fn(async()=>[]),getOpportunityById:vi.fn(async()=>null)},storage:{async get<T>(key:string){return structuredClone(values.get(key)??null) as T|null;},set:vi.fn(async(key,value)=>{values.set(key,structuredClone(value));}),remove:vi.fn(async key=>{values.delete(key);})},ai:{state:'unconfigured',generate:vi.fn(async()=>{throw new Error('unconfigured');})},navigation:{go:vi.fn(),facultyPath:id=>`/app/faculty/${encodeURIComponent(id)}`,opportunityPath:id=>`/app/opportunities/${encodeURIComponent(id)}`},config:{appMode:'live',community:{repo:null,repoId:null,category:null,categoryId:null}}};
}
