import { useMemo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import type { HostApi, StudentProfile } from '@/sdk/contracts';
import facultyModule from '../module';
import { student, testApi } from './helpers';
import { localRequest } from '@/integrations/client';
import { demoRepository } from './staticRepository';

vi.mock('@/integrations/client', () => ({localRequest: vi.fn()}));
beforeEach(() => {
  vi.mocked(localRequest).mockImplementation(async (_userId, path) => {
    if (path.startsWith('/api/faculty?')) {
      const params = new URLSearchParams(path.split('?')[1]);
      const all = await demoRepository.searchEntries({});
      const items = (await demoRepository.searchEntries({text: params.get('q') || '', institution: params.get('institution') || ''})).filter(e => (!params.get('department') || e.faculty.department === params.get('department')) && (!params.get('area') || e.faculty.researchAreas.includes(params.get('area')!)) && (!params.get('status') || e.faculty.recruitmentStatus === params.get('status')));
      return {items, total: items.length, page: 1, page_size: 12, source: 'thu', institutions: [...new Set(all.map(x => x.faculty.institution))], departments: [...new Set(all.map(x => x.faculty.department!))]};
    }
    const entry = await demoRepository.getEntry(decodeURIComponent(path.split('/').pop()!));
    if (!entry) throw new Error('未找到导师资料，请先搜索该研究者。');
    return entry;
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function RoutedModule({ api, profile }: { api: HostApi; profile: StudentProfile }) {
  const navigate = useNavigate();
  const boundApi = useMemo(() => ({ ...api, navigation: { ...api.navigation, go: (path: string) => { api.navigation.go(path); navigate(path); } } }), [api, navigate]);
  const Root = facultyModule.Root;
  return <Routes><Route path="/app/faculty/*" element={<Root api={boundApi} profile={profile} />} /><Route path="/app/outreach" element={<p>邮件模块入口</p>} /><Route path="/app/opportunities/*" element={<p>项目模块入口</p>} /></Routes>;
}
function Harness({ api, profile = student(), path = '/app/faculty' }: { api: HostApi; profile?: StudentProfile; path?: string }) {
  return <MemoryRouter initialEntries={[path]}><RoutedModule api={api} profile={profile} /></MemoryRouter>;
}
describe('faculty search and detail workflow', () => {
  it('supports host q links, favorites, detail, notes and the outreach handoff', async () => {
    const { api, memory } = testApi();
    render(<Harness api={api} path="/app/faculty?q=LLM" />);
    expect(await screen.findByRole('heading', { name: '演示导师 A（虚构）' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '演示导师 B（虚构）' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收藏演示导师 A（虚构）' }));
    await screen.findByRole('button', { name: '取消收藏演示导师 A（虚构）' });
    fireEvent.click(screen.getByRole('button', { name: /查看详情/ }));
    await screen.findByRole('heading', { name: '研究背景与公开资料' });
    expect(screen.getByText(/成功率暂无可信数据/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /查找相关项目/ }));
    await screen.findByText(/暂未取得相关项目记录/);
    fireEvent.change(screen.getByLabelText('待核查的问题'), { target: { value: '本科生可以从什么任务开始？' } });
    fireEvent.change(screen.getByLabelText('我的阅读与联系准备'), { target: { value: '仅看了介绍，尚未阅读论文。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存准备记录' }));
    await screen.findByText('联系准备已保存到当前账户。');
    expect(JSON.stringify(memory.get('candidate-list.v1'))).toContain('尚未阅读论文');
    expect(api.ai.generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '准备联系邮件' }));
    expect(await screen.findByText('邮件模块入口')).toBeInTheDocument();
    expect(api.navigation.go).toHaveBeenLastCalledWith('/app/outreach?facultyId=faculty%3Ademo%3Alanguage');
  });
  it('combines filters and recovers from empty results without substituting people', async () => {
    const { api } = testApi(); render(<Harness api={api} />);
    await screen.findByRole('heading', { name: '演示导师 F（虚构）' });
    fireEvent.change(screen.getByLabelText('学校'), { target: { value: '清华大学（演示场景）' } });
    fireEvent.change(screen.getByLabelText('院系'), { target: { value: '计算机方向（虚构）' } });
    fireEvent.change(screen.getByLabelText('研究方向'), { target: { value: 'ai-computing' } });
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('招募状态'), { target: { value: 'confirmed_open' } });
    expect(await screen.findByRole('heading', { name: '还没有找到符合条件的记录' })).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '清除筛选，重新探索' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(6));
  });
  it('reports a backend failure without falling back to demo data', async () => {
    const { api } = testApi();
    vi.mocked(localRequest).mockRejectedValue(new Error('本地数据库暂时不可用'));
    render(<Harness api={api} path="/app/faculty?data=live" />);
    expect(await screen.findByText('本地数据库暂时不可用')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('button', {name: '查看演示数据'})).not.toBeInTheDocument();
    expect(api.ai.generate).not.toHaveBeenCalled();
  });
  it('sends a name search to OpenAlex using the current account', async () => {
    const { api } = testApi();
    render(<Harness api={api} path="/app/faculty?data=openalex&search_mode=name&q=Hinton" />);
    await waitFor(() => expect(localRequest).toHaveBeenCalledWith('synthetic-student-one', expect.stringContaining('source=openalex'), expect.anything()));
    expect(vi.mocked(localRequest).mock.calls.some(([, path]) => path.includes('search_mode=name') && path.includes('q=Hinton'))).toBe(true);
    expect(screen.queryByText('演示数据')).not.toBeInTheDocument();
    await screen.findByRole('heading', {name:'还没有找到符合条件的记录'});
    const requests = vi.mocked(localRequest).mock.calls.length;
    fireEvent.change(screen.getByLabelText('排序'), {target:{value:'name'}});
    expect(vi.mocked(localRequest).mock.calls.length).toBe(requests);
  });
  it('supports detail deep links, missing facts, and missing IDs', async () => {
    const { api } = testApi(); const view = render(<Harness api={api} path="/app/faculty/faculty%3Ademo%3Aprotein" />);
    await screen.findByRole('heading', { name: '演示导师 C（虚构）' });
    expect(screen.getByText(/未取得有来源支持的代表作品/)).toBeInTheDocument();
    expect(screen.getByText(/未取得公开成员名单/)).toBeInTheDocument();
    view.unmount(); render(<Harness api={api} path="/app/faculty/missing" />);
    await screen.findByText('未找到导师资料，请先搜索该研究者。');
  });
  it('reacts to profile changes and isolates a switched local account', async () => {
    const first = testApi(); const second = testApi();
    const view = render(<Harness api={first.api} profile={student()} path="/app/faculty?q=LLM" />);
    await screen.findByRole('heading', { name: '演示导师 A（虚构）' });
    expect(screen.getByLabelText('兴趣参考分 100')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收藏演示导师 A（虚构）' }));
    await screen.findByRole('button', { name: '取消收藏演示导师 A（虚构）' });
    view.rerender(<Harness api={first.api} profile={student({ researchAreas: ['bio-medicine'], interestKeywords: [] })} />);
    expect(screen.getByLabelText('兴趣参考分 0')).toBeInTheDocument();
    view.rerender(<Harness api={second.api} profile={student({ userId: 'synthetic-student-two' })} />);
    await screen.findByRole('button', { name: '收藏演示导师 A（虚构）' });
    expect(second.memory.size).toBe(0); expect(first.memory.size).toBe(1);
  });
  it('preserves edited notes on storage failure and allows retry', async () => {
    const { api } = testApi(); vi.mocked(api.storage.set).mockRejectedValueOnce(new Error('quota'));
    render(<Harness api={api} path="/app/faculty/faculty%3Ademo%3Alanguage" />);
    await screen.findByRole('heading', { name: '研究背景与公开资料' });
    fireEvent.change(screen.getByLabelText('待核查的问题'), { target: { value: '保存失败也不能丢失的问题' } });
    fireEvent.click(screen.getByRole('button', { name: '保存准备记录' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('待核查的问题')).toHaveValue('保存失败也不能丢失的问题');
    fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '保存准备记录' })).toBeEnabled());
    expect(screen.getByLabelText('待核查的问题')).toHaveValue('保存失败也不能丢失的问题');
    fireEvent.click(screen.getByRole('button', { name: '保存准备记录' }));
    await screen.findByText('联系准备已保存到当前账户。');
  });
  it('waits for slow local storage before editing, so saved notes cannot overwrite a new draft', async () => {
    const { api } = testApi();
    let resolveRead!: (value: unknown) => void;
    const pending = new Promise<unknown>(resolve => { resolveRead = resolve; });
    api.storage.get = async <T,>() => await pending as T | null;
    render(<Harness api={api} path="/app/faculty/faculty%3Ademo%3Alanguage" />);
    await screen.findByRole('heading', { name: '研究背景与公开资料' });
    expect(screen.getByLabelText('待核查的问题')).toBeDisabled();
    resolveRead({ version: 1, entries: { 'faculty:demo:language': { saved: true, questions: '原有问题', note: '', preparation: 'reading', updatedAt: '2026-10-18T00:00:00Z' } } });
    await waitFor(() => expect(screen.getByLabelText('待核查的问题')).toBeEnabled());
    expect(screen.getByLabelText('待核查的问题')).toHaveValue('原有问题');
  });
  it('distinguishes a thematic project from an explicit linked project, and eligibility from status', async () => {
    const { api } = testApi();
    const common = { institution: '测试机构', countryOrRegion: 'test', type: 'srt' as const, researchAreas: ['ai-computing'], summary: 'test', eligibility: 'home_institution_only' as const, status: 'unknown' as const, lastCheckedAt: '2026-10-18T00:00:00Z', sources: [], isDemo: true };
    vi.mocked(api.catalog.searchOpportunities).mockResolvedValue([{ ...common, id: 'p1', title: '仅方向相近' }, { ...common, id: 'p2', title: '明确关联', linkedFacultyIds: ['faculty:demo:language'] }]);
    render(<Harness api={api} path="/app/faculty/faculty%3Ademo%3Alanguage" />);
    await screen.findByRole('heading', { name: '研究背景与公开资料' });
    fireEvent.click(screen.getByRole('button', { name: /查找相关项目/ }));
    const heading = await screen.findByRole('heading', { name: '仅方向相近' });
    expect(within(heading.closest('article')!).getByText(/未确认属于该团队/)).toBeInTheDocument();
    expect(screen.getByText(/记录明确关联该导师/)).toBeInTheDocument();
    expect(screen.getAllByText(/资格：限主办高校学生/)).toHaveLength(2);
    expect(screen.getAllByText(/状态：招募状态待核实/)).toHaveLength(2);
  });
});
