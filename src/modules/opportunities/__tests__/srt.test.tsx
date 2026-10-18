import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {localRequest} from '@/integrations/client';
import module from '../module';
import {student, testApi} from '@/modules/faculty/__tests__/helpers';

vi.mock('@/integrations/client', () => ({localRequest: vi.fn()}));
const item = {
  id:'srt-test', title:'测试学生立项项目', description:'项目研究内容', institution:'清华大学', department:'建筑学院', region:'中国大陆',
  period_text:'2026-09 至 2027-08\n完整进度安排', mentors:[], team:'来源团队介绍', mentor_background:'', eligibility_text:'',
  application_method:'校内系统报名', application_url:'https://info.tsinghua.edu.cn/', source_url:'https://info.tsinghua.edu.cn/', source_id:'thu_srt_private',
  collected_at:'2026-10-18T06:55:36.554Z', deadline:'', visibility:'private', kind:'project', effective_status:'unknown', warnings:[], missing_fields:['mentors'],
  contract:{id:'srt-test',title:'测试学生立项项目',institution:'清华大学',countryOrRegion:'中国大陆',type:'srt',researchAreas:[],summary:'项目研究内容',eligibility:'tsinghua_only',status:'unknown',lastCheckedAt:'2026-10-18T06:55:36.554Z',sources:[],isDemo:false},
  srt:{project_id:'TEST-SRT-001',initiation_type:'student',applicant:'测试立项学生',academic_term:'2026-2027-1',batch:1,department:'建筑学院',mentor_department:'',mentor_title:null,
    capacity:'5',credits:'2',expected_outcomes:'测试预期成果',schedule:'完整进度安排',funding_requested:'5000',other_funding:null,status:'报名中'},
};
beforeEach(() => {vi.mocked(localRequest).mockImplementation(async (_id, path) => path.startsWith('/api/projects/') ? structuredClone(item) : {items:[structuredClone(item)],total:1,page:1,page_size:12});});
afterEach(() => {cleanup(); vi.resetAllMocks();});
function show(path: string) {
  const {api} = testApi(); const Root = module.Root;
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/app/opportunities/*" element={<Root api={api} profile={student()}/>}/></Routes></MemoryRouter>);
  return api;
}
it('filters teacher/student projects on the server and keeps applicant separate from mentor', async () => {
  show('/app/opportunities?type=student');
  await screen.findByRole('heading',{name:item.title});
  expect(screen.getByText('测试立项学生')).toBeInTheDocument();
  expect(screen.getByText('TEST-SRT-001')).toBeInTheDocument();
  expect(screen.getByLabelText('项目类型')).toHaveValue('student');
  expect(JSON.parse(vi.mocked(localRequest).mock.calls.at(-1)![2]!.body as string).filters).toMatchObject({source_id:'thu_srt_private',initiation_type:'student',page:1});
  fireEvent.change(screen.getByLabelText('项目类型'),{target:{value:'teacher'}});
  await waitFor(() => expect(JSON.parse(vi.mocked(localRequest).mock.calls.at(-1)![2]!.body as string).filters.initiation_type).toBe('teacher'));
});
it('shows full SRT facts, distinguishes blank/null, and hands the real project ID to outreach', async () => {
  const api = show('/app/opportunities/srt-test');
  await screen.findByRole('heading',{name:'SRT 项目原始资料'});
  expect(screen.getByText('测试预期成果')).toBeInTheDocument();
  expect(screen.getAllByText('来源表未提供此字段').length).toBeGreaterThan(0);
  expect(screen.getByText('原文留空')).toBeInTheDocument();
  expect(screen.getByText(/当前是否仍可报名/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'准备联系 / 资格询问邮件'}));
  expect(api.navigation.go).toHaveBeenLastCalledWith('/app/outreach?opportunityId=srt-test');
});
