import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api, faculty, profile } from './fixtures';
import { DefaultPanel } from '../components/DefaultPanel';
import module from '../module';
import type { Diagnostic } from '../types';

afterEach(cleanup);
const info:Diagnostic={code:'TEST',message:'查询失败的安全摘要',level:'warning'};
describe('default diagnostics panel',()=>{
  it('hides empty entries, starts collapsed, preserves expansion for incremental diagnostics, resets on a new task',()=>{
    const {rerender}=render(<DefaultPanel taskId="one" items={[]}/>);expect(screen.queryByRole('button')).toBeNull();
    rerender(<DefaultPanel taskId="one" items={[info]}/>);expect(screen.queryByText(info.message)).toBeNull();
    fireEvent.click(screen.getByRole('button'));expect(screen.getByText(info.message)).toBeInTheDocument();
    rerender(<DefaultPanel taskId="one" items={[info,{...info,code:'TWO',message:'增量信息'}]}/>);expect(screen.getByText('增量信息')).toBeInTheDocument();
    rerender(<DefaultPanel taskId="two" items={[info]}/>);expect(screen.queryByText(info.message)).toBeNull();
    fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));expect(screen.queryByText(info.message)).toBeNull();
  });
});

function prepareManual(){
  fireEvent.change(screen.getByLabelText('导师姓名或机构称呼'),{target:{value:'示例导师'}});
  fireEvent.click(screen.getByLabelText('我已核对姓名、机构及主页，确认联系对象'));
}
describe('integrated module UI paths',()=>{
  it('has the frozen default export and works without other modules or AI',async()=>{
    expect(module.id).toBe('outreach');expect(module.contractVersion).toBe('1.0.0');
    const a=api(),p=profile();const Root=module.Root;
    render(<MemoryRouter><Root api={a} profile={p}/></MemoryRouter>);prepareManual();
    expect(screen.getByRole('button',{name:'AI 辅助生成'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'生成本地草稿'}));
    await screen.findByRole('region',{name:'邮件编辑器'});
    const chinese=(screen.getByLabelText('正文') as HTMLTextAreaElement).value;expect(chinese).toContain('请问您是否');
    expect(a.catalog.searchFaculty).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab',{name:'English'}));expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toContain('May I ask');
    fireEvent.change(screen.getByLabelText('正文'),{target:{value:'My revised message.\n\nThank you for your time.'}});
    fireEvent.change(screen.getByLabelText('草稿名称'),{target:{value:'My saved draft'}});
    fireEvent.change(screen.getByLabelText('手动联系状态'),{target:{value:'sent'}});
    fireEvent.click(screen.getByRole('button',{name:'保存草稿'}));await screen.findByRole('button',{name:/My saved draft/});
    expect(a.storage.set).toHaveBeenCalledTimes(1);expect(screen.getByText(/原生成时的事实检查/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'删除'}));fireEvent.click(screen.getByRole('button',{name:'确认删除'}));await waitFor(()=>expect(screen.queryByRole('button',{name:/My saved draft/})).toBeNull());
    expect(a.ai.generate).not.toHaveBeenCalled();
  });
  it('supports deep links, with unavailable catalog data safely falling back',async()=>{
    const a=api(),p=profile();const Root=module.Root;
    render(<MemoryRouter initialEntries={['/app/outreach?facultyId=missing&opportunityId=absent']}><Root api={a} profile={p}/></MemoryRouter>);
    await waitFor(()=>expect(screen.getByRole('button',{name:/查询详情/})).toBeInTheDocument());expect(a.catalog.getFacultyById).toHaveBeenCalledWith('missing',expect.anything());expect(a.catalog.getOpportunityById).toHaveBeenCalledWith('absent',expect.anything());
    expect(screen.queryByText('原导师记录不可用，可手动填写公开资料。')).toBeNull();fireEvent.click(screen.getByRole('button',{name:/查询详情/}));expect(screen.getByText('原导师记录不可用，可手动填写公开资料。')).toBeInTheDocument();
  });
  it('loads catalog identity and sources but requires explicit confirmation',async()=>{
    const a=api(),p=profile();vi.mocked(a.catalog.getFacultyById).mockResolvedValue(faculty());const Root=module.Root;
    render(<MemoryRouter initialEntries={['/app/outreach?facultyId=faculty%3Atest']}><Root api={a} profile={p}/></MemoryRouter>);
    await screen.findByRole('button',{name:'改为手动填写'});fireEvent.click(screen.getByRole('button',{name:'生成本地草稿'}));await screen.findByRole('alert');expect(screen.queryByRole('region',{name:'邮件编辑器'})).toBeNull();
    fireEvent.click(screen.getByLabelText('我已核对姓名、机构及主页，确认联系对象'));fireEvent.click(screen.getByRole('button',{name:'生成本地草稿'}));await screen.findByRole('region',{name:'邮件编辑器'});expect(screen.getByText(/research@example.org/)).toBeInTheDocument();
  });
  it('shows complete per-call consent and preserves existing draft on AI failure without exposing server errors',async()=>{
    const a=api(),p=profile();a.ai={state:'ready',generate:vi.fn(async()=>{throw new Error('secret-provider-key-stack');})};const Root=module.Root;
    render(<MemoryRouter><Root api={a} profile={p}/></MemoryRouter>);prepareManual();fireEvent.click(screen.getByRole('button',{name:'生成本地草稿'}));await screen.findByRole('region',{name:'邮件编辑器'});
    const before=(screen.getByLabelText('正文') as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole('button',{name:'AI 辅助生成'}));const dialog=await screen.findByRole('dialog');expect(dialog).toHaveTextContent('完整资料');expect(screen.getByRole('button',{name:'同意并生成'})).toBeDisabled();expect(a.ai.generate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('发送资料完整预览')).not.toHaveTextContent(p.userId);
    fireEvent.click(screen.getByLabelText('我同意本次将以上资料发送给已配置的 AI 服务'));fireEvent.click(screen.getByRole('button',{name:'同意并生成'}));await screen.findByRole('alert');
    expect(a.ai.generate).toHaveBeenCalledTimes(1);expect((screen.getByLabelText('正文') as HTMLTextAreaElement).value).toBe(before);expect(screen.queryByText(/secret-provider-key-stack/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'AI 辅助生成'}));expect(screen.getByRole('button',{name:'同意并生成'})).toBeDisabled();
  });
  it('switching accounts or profile versions clears unsaved private editor and consent',async()=>{
    const a=api(),p=profile();a.ai={state:'ready',generate:vi.fn()};const Root=module.Root;
    const {rerender}=render(<MemoryRouter><Root api={a} profile={p}/></MemoryRouter>);prepareManual();fireEvent.click(screen.getByRole('button',{name:'生成本地草稿'}));await screen.findByRole('region',{name:'邮件编辑器'});
    fireEvent.click(screen.getByRole('button',{name:'AI 辅助生成'}));await screen.findByRole('dialog');
    rerender(<MemoryRouter><Root api={api()} profile={profile('another-user')}/></MemoryRouter>);
    await waitFor(()=>expect(screen.getByLabelText(/用于生成的署名/)).toHaveValue('Sample Student'));
    expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('region',{name:'邮件编辑器'})).toBeNull();expect(screen.getByLabelText('导师姓名或机构称呼')).toHaveValue('');
    expect(a.ai.generate).not.toHaveBeenCalled();
  });
});
