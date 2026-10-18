import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { AppearanceControls } from '@/app/components/AppearanceControls';
import { getAccounts, getProfile, restoreBackup } from '@/app/services/db';
import { getUiPreferences, PREFERENCES_KEY, setUiPreferences } from '@/app/preferences/store';

beforeEach(async () => {
  setUiPreferences({ locale: 'zh-CN', theme: 'forest' });
  await restoreBackup({ kind:'researchspace-local-backup', version:1, exportedAt:new Date().toISOString(), accounts:[], profiles:[], moduleKV:[] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); setUiPreferences({ locale:'zh-CN', theme:'forest' }); });

describe('appearance and language in the research workflow', () => {
  it('switches language during onboarding without losing input or changing research language preferences', async () => {
    render(<MemoryRouter initialEntries={['/welcome']}><App/></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('怎么称呼你？'), { target:{value:'小张'} });
    fireEvent.click(screen.getByRole('button', {name:'创建我的科研档案'}));
    await screen.findByText('你好，先认识一下你。');
    fireEvent.click(screen.getByRole('button', {name:'大二'}));
    fireEvent.change(screen.getByLabelText('院系或专业（选填）'), { target:{value:'计算机科学'} });
    fireEvent.click(screen.getAllByRole('button', {name:/下一步/})[0]);
    fireEvent.click(screen.getByRole('button', {name:/参加 SRT/}));
    fireEvent.click(screen.getAllByRole('button', {name:/下一步/})[0]);
    fireEvent.click(screen.getByRole('button', {name:'AI 与计算'}));
    const keywords = screen.getByLabelText('有更具体的兴趣吗？（选填）');
    fireEvent.change(keywords, {target:{value:'视频生成、'}});
    expect(keywords).toHaveValue('视频生成、');
    fireEvent.change(keywords, {target:{value:'视频生成、时序一致性'}});
    fireEvent.change(screen.getByLabelText('界面语言'), {target:{value:'en'}});
    expect(screen.getByRole('heading', {name:'What makes you curious?'})).toBeInTheDocument();
    expect(screen.getByLabelText('Any specific interests? (optional)')).toHaveValue('视频生成、时序一致性');
    expect(screen.getByRole('button', {name:'AI & computing'})).toHaveAttribute('aria-pressed','true');
    fireEvent.change(screen.getByLabelText('Theme color'), {target:{value:'ocean'}});
    expect(document.documentElement).toHaveAttribute('data-theme','ocean');
    for (let step=2; step<5; step++) fireEvent.click(screen.getAllByRole('button', {name:'Next'})[0]);
    fireEvent.click(screen.getAllByRole('button', {name:'Finish profile'})[0]);
    await screen.findByRole('heading', {name:/小张/});
    const accounts = await getAccounts();
    const profile = await getProfile(accounts[0].id);
    expect(profile).toMatchObject({ undergraduateYear:'year2', department:'计算机科学', goals:['srt'], researchAreas:['ai-computing'], interestKeywords:['视频生成','时序一致性'], preferredLanguages:['zh'] });
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({locale:'en',theme:'ocean'});
    fireEvent.click(screen.getByRole('link', {name:'My research profile'}));
    expect(screen.getByRole('heading', {name:'My research profile'})).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Interface language'), {target:{value:'zh-CN'}});
    expect(screen.getByRole('heading', {name:'我的科研画像'})).toBeInTheDocument();
    expect(screen.getByText('视频生成、时序一致性')).toBeInTheDocument();
  });

  it('keeps settings usable when browser persistence is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('storage blocked');});
    render(<AppearanceControls/>);
    fireEvent.change(screen.getByLabelText('界面语言'), {target:{value:'en'}});
    fireEvent.change(screen.getByLabelText('Theme color'), {target:{value:'violet'}});
    expect(document.documentElement).toHaveAttribute('lang','en');
    expect(screen.getByLabelText('Theme color')).toHaveValue('violet');
  });

  it('synchronizes settings from another tab and safely handles invalid stored data', async () => {
    render(<AppearanceControls/>);
    act(() => window.dispatchEvent(new StorageEvent('storage', {key:PREFERENCES_KEY,newValue:JSON.stringify({locale:'en',theme:'rose'})})));
    await waitFor(() => expect(screen.getByLabelText('Theme color')).toHaveValue('rose'));
    expect(document.documentElement).toHaveAttribute('lang','en');
    act(() => window.dispatchEvent(new StorageEvent('storage', {key:PREFERENCES_KEY,newValue:'invalid JSON'})));
    expect(getUiPreferences()).toEqual({locale:'zh-CN',theme:'forest'});
    expect(screen.getByLabelText('界面语言')).toHaveValue('zh-CN');
  });
});
