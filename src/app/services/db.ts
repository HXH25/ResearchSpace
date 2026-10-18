import { translate as t } from '@/app/i18n';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import type { StudentProfile, ModuleId } from '@/sdk/contracts';
export type AvatarTone = 'mint' | 'lavender' | 'sunset' | 'sky';
export interface LocalAccount {
    id: string;
    nickname: string;
    avatarTone: AvatarTone;
    createdAt: string;
    updatedAt: string;
}
interface StoredValue {
    key: string;
    value: unknown;
}
interface ResearchSpaceDatabase extends DBSchema {
    serviceCredentials: {
        key: string;
        value: { userId: string; token: string };
    };
    accounts: {
        key: string;
        value: LocalAccount;
    };
    profiles: {
        key: string;
        value: StudentProfile;
    };
    moduleKV: {
        key: string;
        value: StoredValue;
    };
}
const DB_NAME = 'researchspace-local-v1';
const SELECTED_ACCOUNT_KEY = 'researchspace:selected-user:v1';
let dbPromise: Promise<IDBPDatabase<ResearchSpaceDatabase>> | undefined;
function db() {
    if (!dbPromise) {
        dbPromise = openDB<ResearchSpaceDatabase>(DB_NAME, 2, {
            upgrade(database) {
                if (!database.objectStoreNames.contains('serviceCredentials'))
                    database.createObjectStore('serviceCredentials', { keyPath: 'userId' });
                if (!database.objectStoreNames.contains('accounts'))
                    database.createObjectStore('accounts', { keyPath: 'id' });
                if (!database.objectStoreNames.contains('profiles'))
                    database.createObjectStore('profiles', { keyPath: 'userId' });
                if (!database.objectStoreNames.contains('moduleKV'))
                    database.createObjectStore('moduleKV', { keyPath: 'key' });
            },
        });
    }
    return dbPromise;
}
export async function getAccounts(): Promise<LocalAccount[]> {
    return (await (await db()).getAll('accounts')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function createAccount(nickname: string, avatarTone: AvatarTone): Promise<LocalAccount> {
    const now = new Date().toISOString();
    const item: LocalAccount = {
        id: crypto.randomUUID(), nickname: nickname.trim().slice(0, 24), avatarTone,
        createdAt: now, updatedAt: now,
    };
    if (!item.nickname)
        throw new Error(t("请输入一个昵称"));
    await (await db()).put('accounts', item);
    return item;
}
export async function getProfile(userId: string) { return (await db()).get('profiles', userId); }
export async function saveProfile(profile: StudentProfile) {
    const checked = validateProfile(profile);
    const accountForProfile = await (await db()).get('accounts', checked.userId);
    if (!accountForProfile)
        throw new Error(t("找不到画像对应的本地账户"));
    await (await db()).put('profiles', checked);
    const database = await db();
    const account = await database.get('accounts', checked.userId);
    if (account)
        await database.put('accounts', { ...account, updatedAt: new Date().toISOString() });
}
export async function deleteAccount(userId: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['accounts', 'profiles', 'moduleKV', 'serviceCredentials'], 'readwrite');
    await tx.objectStore('serviceCredentials').delete(userId);
    await tx.objectStore('accounts').delete(userId);
    await tx.objectStore('profiles').delete(userId);
    const items = await tx.objectStore('moduleKV').getAllKeys();
    for (const key of items)
        if (key.startsWith(`${userId}::`))
            await tx.objectStore('moduleKV').delete(key);
    await tx.done;
    if (getSelectedAccountId() === userId)
        clearSelectedAccountId();
}
function namespacedKey(userId: string, moduleId: ModuleId, key: string): string {
    if (!key || key.length > 250 || key.includes('::'))
        throw new Error(t("无效的模块存储键"));
    return `${userId}::${moduleId}::${key}`;
}
export function createModuleStorage(userId: string, moduleId: ModuleId) {
    return {
        async get<T>(key: string): Promise<T | null> {
            const record = await (await db()).get('moduleKV', namespacedKey(userId, moduleId, key));
            return record ? (record.value as T) : null;
        },
        async set<T>(key: string, value: T): Promise<void> {
            const k = namespacedKey(userId, moduleId, key);
            await (await db()).put('moduleKV', { key: k, value });
        },
        async remove(key: string): Promise<void> {
            await (await db()).delete('moduleKV', namespacedKey(userId, moduleId, key));
        },
    };
}
export function getSelectedAccountId(): string | null {
    try {
        return localStorage.getItem(SELECTED_ACCOUNT_KEY);
    }
    catch {
        return null;
    }
}

/** A local service capability, NOT a provider API key. Deliberately excluded from JSON backups. */
export async function getServiceCredential(userId: string): Promise<string> {
    const database = await db();
    const tx = database.transaction('serviceCredentials', 'readwrite');
    const found = await tx.store.get(userId);
    if (found) { await tx.done; return found.token; }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
    await tx.store.put({userId, token});
    await tx.done;
    return token;
}
export function selectAccountId(userId: string) {
    try {
        localStorage.setItem(SELECTED_ACCOUNT_KEY, userId);
    }
    catch { /* private storage disabled */ }
}
export function clearSelectedAccountId() {
    try {
        localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
    catch { /* private storage disabled */ }
}
const accountSchema = z.object({
    id: z.string().min(1), nickname: z.string().min(1).max(24),
    avatarTone: z.enum(['mint', 'lavender', 'sunset', 'sky']),
    createdAt: z.string(), updatedAt: z.string(),
}).strict();
const profileSchema = z.object({
    schemaVersion: z.literal(1), userId: z.string().min(1), displayName: z.string().min(1),
    institution: z.string(), department: z.string().optional(),
    undergraduateYear: z.enum(['year1', 'year2', 'year3', 'year4', 'year5', 'undecided']),
    goals: z.array(z.enum(['explore_research', 'join_lab', 'srt', 'summer_research', 'overseas_research', 'postgraduate_preparation'])),
    researchAreas: z.array(z.string()), interestKeywords: z.array(z.string()), skills: z.array(z.string()),
    skillEvidence: z.array(z.object({ skill: z.string().max(100), description: z.string().max(500), url: z.url().refine((value) => /^https?:\/\//i.test(value), '需要 http(s) 链接').optional() })).optional(),
    experience: z.enum(['none', 'course_projects', 'prior_research', 'undecided']),
    workPreferences: z.array(z.enum(['literature', 'coding', 'theory', 'experiments', 'data', 'fieldwork', 'undecided'])),
    guidancePreference: z.enum(['structured', 'independent', 'undecided']),
    weeklyHours: z.number().min(0).max(60).optional(),
    availability: z.enum(['now', 'this_term', 'next_term', 'summer', 'undecided']),
    preferredLanguages: z.array(z.enum(['zh', 'en', 'other'])),
    onboardingCompletedAt: z.string().optional(), updatedAt: z.string(),
}).strict();
export function validateProfile(value: unknown): StudentProfile {
    return profileSchema.parse(value);
}
const backupSchema = z.object({
    kind: z.literal('researchspace-local-backup'), version: z.literal(1),
    exportedAt: z.string(), accounts: z.array(accountSchema), profiles: z.array(profileSchema),
    moduleKV: z.array(z.object({ key: z.string(), value: z.unknown() })),
}).strict();
export type Backup = z.infer<typeof backupSchema>;
export async function exportBackup(): Promise<Backup> {
    const database = await db();
    return {
        kind: 'researchspace-local-backup', version: 1,
        exportedAt: new Date().toISOString(), accounts: await database.getAll('accounts'),
        profiles: await database.getAll('profiles'), moduleKV: await database.getAll('moduleKV'),
    };
}
export function parseBackup(raw: unknown): Backup {
    const parsed = backupSchema.parse(raw);
    const ids = new Set(parsed.accounts.map((a) => a.id));
    if (ids.size !== parsed.accounts.length)
        throw new Error(t("备份中包含重复账号 ID"));
    const profileIds = new Set<string>();
    for (const profile of parsed.profiles) {
        if (!ids.has(profile.userId))
            throw new Error(t("备份画像不属于任何本地账号"));
        if (profileIds.has(profile.userId))
            throw new Error(t("备份中包含重复画像"));
        profileIds.add(profile.userId);
    }
    const kvKeys = new Set<string>();
    for (const item of parsed.moduleKV) {
        const segments = item.key.split('::');
        if (segments.length !== 3 || !ids.has(segments[0]) || !['faculty', 'opportunities', 'community', 'outreach'].includes(segments[1]) || !segments[2] || segments[2].length > 250) {
            throw new Error(t("备份中有无效的模块存储数据"));
        }
        if (kvKeys.has(item.key))
            throw new Error(t("备份中包含重复模块存储键"));
        kvKeys.add(item.key);
    }
    return parsed;
}
export async function restoreBackup(backup: Backup): Promise<void> {
    const data = parseBackup(backup);
    const database = await db();
    const tx = database.transaction(['accounts', 'profiles', 'moduleKV'], 'readwrite');
    await tx.objectStore('accounts').clear();
    await tx.objectStore('profiles').clear();
    await tx.objectStore('moduleKV').clear();
    for (const account of data.accounts)
        await tx.objectStore('accounts').put(account);
    for (const profile of data.profiles)
        await tx.objectStore('profiles').put(profile);
    for (const item of data.moduleKV)
        await tx.objectStore('moduleKV').put(item);
    await tx.done;
    clearSelectedAccountId();
}
