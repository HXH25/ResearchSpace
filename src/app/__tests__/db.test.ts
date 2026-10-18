import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAccount, createModuleStorage, deleteAccount, exportBackup, getAccounts,
  getProfile, parseBackup, restoreBackup, saveProfile, selectAccountId,
  getSelectedAccountId,
} from '@/app/services/db';
import { defaultProfile } from '@/app/utils/profile';

let counter = 0;
const emptyBackup = () => ({
  kind: 'researchspace-local-backup' as const,
  version: 1 as const,
  exportedAt: new Date().toISOString(),
  accounts: [], profiles: [], moduleKV: [],
});

beforeEach(async () => {
  vi.stubGlobal('crypto', { randomUUID: () => `local-test-id-${++counter}` });
  await restoreBackup(emptyBackup());
});

describe('local accounts and scoped module storage', () => {
  it('isolates data for different accounts and modules', async () => {
    const alice = await createAccount(' Alice ', 'mint');
    const bob = await createAccount('Bob', 'sky');
    expect(alice.nickname).toBe('Alice');
    const aFaculty = createModuleStorage(alice.id, 'faculty');
    const bFaculty = createModuleStorage(bob.id, 'faculty');
    const aCommunity = createModuleStorage(alice.id, 'community');
    await aFaculty.set('saved', ['item-a']);
    await bFaculty.set('saved', ['item-b']);
    expect(await aFaculty.get<string[]>('saved')).toEqual(['item-a']);
    expect(await bFaculty.get<string[]>('saved')).toEqual(['item-b']);
    expect(await aCommunity.get('saved')).toBeNull();
    await deleteAccount(alice.id);
    expect(await aFaculty.get('saved')).toBeNull();
    expect(await bFaculty.get<string[]>('saved')).toEqual(['item-b']);
    expect((await getAccounts()).map((a) => a.nickname)).toEqual(['Bob']);
  });

  it('preserves and restores profiles and module data in a backup', async () => {
    const alice = await createAccount('测试用户', 'lavender');
    const profile = defaultProfile(alice.id, alice.nickname);
    profile.goals = ['srt'];
    profile.onboardingCompletedAt = new Date().toISOString();
    await saveProfile(profile);
    await createModuleStorage(alice.id, 'outreach').set('draft', 'hello');
    selectAccountId(alice.id);
    const backup = await exportBackup();
    expect(parseBackup(JSON.parse(JSON.stringify(backup))).accounts).toHaveLength(1);
    await restoreBackup(emptyBackup());
    expect(await getAccounts()).toHaveLength(0);
    await restoreBackup(backup);
    expect((await getProfile(alice.id))?.goals).toEqual(['srt']);
    expect(await createModuleStorage(alice.id, 'outreach').get('draft')).toBe('hello');
    expect(getSelectedAccountId()).toBeNull();
  });

  it('rejects dangling profiles, duplicate IDs and cross-account malformed KV data', async () => {
    const alice = await createAccount('A', 'mint');
    const good = await exportBackup();
    const fakeProfile = defaultProfile('missing-id', 'Unknown');
    expect(() => parseBackup({ ...good, profiles: [fakeProfile] })).toThrow('备份画像不属于任何本地账号');
    expect(() => parseBackup({ ...good, accounts: [alice, alice] })).toThrow('重复账号');
    expect(() => parseBackup({ ...good, moduleKV: [{key: 'missing-id::faculty::x', value: 1}] })).toThrow('无效的模块');
    expect(() => parseBackup({ ...good, moduleKV: [
      {key: `${alice.id}::faculty::x`,value:1},
      {key: `${alice.id}::faculty::x`,value:2},
    ] })).toThrow('重复模块存储键');
  });

  it('rejects invalid personal evidence links and invalid scoped keys', async () => {
    const alice = await createAccount('A', 'mint');
    const profile = defaultProfile(alice.id, alice.nickname);
    profile.skillEvidence = [{skill:'course-project',description:'test',url:'javascript:alert(1)'}];
    await expect(saveProfile(profile)).rejects.toThrow();
    await expect(createModuleStorage(alice.id,'faculty').set('x::bad',42)).rejects.toThrow();
  });
});
