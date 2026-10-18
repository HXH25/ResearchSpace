import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Onboarding } from '@/app/pages/Onboarding';
import { defaultProfile } from '@/app/utils/profile';
import type { StudentProfile } from '@/sdk/contracts';

describe('six-step onboarding', () => {
  it('allows undecided students to finish and later edit their profile', async () => {
    const onSave=vi.fn(async (_profile:StudentProfile):Promise<void> => undefined);
    const initial=defaultProfile('student-1','同学');
    render(<MemoryRouter initialEntries={['/onboarding']}><Routes>
      <Route path="/onboarding" element={<Onboarding initial={initial} onSave={onSave}/>}/>
      <Route path="/app" element={<span>画像已保存</span>}/>
    </Routes></MemoryRouter>);
    expect(screen.getByText('你好，先认识一下你。')).toBeInTheDocument();
    for(let step=0;step<5;step++) {
      fireEvent.click(screen.getAllByRole('button',{name:/下一步/})[0]);
    }
    fireEvent.click(screen.getAllByRole('button',{name:/完成画像/})[0]);
    await waitFor(()=>expect(onSave).toHaveBeenCalledTimes(1));
    const saved=onSave.mock.calls[0][0];
    expect(saved.userId).toBe('student-1');
    expect(saved.onboardingCompletedAt).toBeTruthy();
    expect(await screen.findByText('画像已保存')).toBeInTheDocument();
  });
});
