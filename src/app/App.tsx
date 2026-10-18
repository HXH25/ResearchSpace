import { useUiPreferences } from '@/app/preferences/store';
import { translate as t } from '@/app/i18n';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import type { StudentProfile } from '@/sdk/contracts';
import { getAccounts, createAccount, getProfile, saveProfile, getSelectedAccountId, selectAccountId, clearSelectedAccountId, type LocalAccount, type AvatarTone, } from '@/app/services/db';
import { defaultProfile } from '@/app/utils/profile';
import { Landing } from '@/app/pages/Landing';
import { Welcome } from '@/app/pages/Welcome';
import { Onboarding } from '@/app/pages/Onboarding';
import { Shell } from '@/app/components/Shell';
export function App() {
    // Subscribe at the host root so all existing pages update without remounting forms.
    useUiPreferences();
    const [accounts, setAccounts] = useState<LocalAccount[]>([]);
    const [account, setAccount] = useState<LocalAccount | null>(null);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [fatalError, setFatalError] = useState('');
    const navigate = useNavigate();
    const reload = useCallback(async () => {
        const list = await getAccounts();
        setAccounts(list);
        const selected = getSelectedAccountId();
        const active = list.find(a => a.id === selected) ?? null;
        setAccount(active);
        setProfile(active ? (await getProfile(active.id)) ?? null : null);
        return active;
    }, []);
    useEffect(() => { let cancelled = false; (async () => { try {
        await reload();
    }
    catch (error) {
        if (!cancelled)
            setFatalError(error instanceof Error ? error.message : t("无法读取本地数据"));
    }
    finally {
        if (!cancelled)
            setLoading(false);
    } })(); return () => { cancelled = true; }; }, [reload]);
    async function create(nickname: string, tone: AvatarTone) { const next = await createAccount(nickname, tone); selectAccountId(next.id); await reload(); navigate('/onboarding'); }
    async function choose(id: string) { if (!accounts.some(a => a.id === id))
        throw new Error(t("本地账户不存在")); selectAccountId(id); await reload(); const found = await getProfile(id); navigate(found?.onboardingCompletedAt ? '/app' : '/onboarding'); }
    async function storeProfile(value: StudentProfile) { if (!account || value.userId !== account.id)
        throw new Error(t("当前账户与画像不匹配")); await saveProfile(value); await reload(); }
    function switchUser() { navigate('/welcome'); }
    async function afterDelete() { clearSelectedAccountId(); await reload(); }
    if (loading)
        return <div className="loading-scene"><LoaderCircle size={36} className="spin"/><strong>ResearchSpace</strong><span>{t("正在打开你的科研空间")}</span></div>;
    if (fatalError)
        return <div className="loading-scene"><h2>{t("无法载入本地数据")}</h2><p>{t(fatalError)}</p><p>{t("可能是浏览器禁用了 IndexedDB 或本地存储；请检查浏览器隐私设置。")}</p></div>;
    const completed = Boolean(account && profile?.onboardingCompletedAt);
    return <Routes>
    <Route path="/" element={<Landing hasAccount={Boolean(account)}/>}/>
    <Route path="/welcome" element={<Welcome accounts={accounts} onCreate={create} onSelect={choose}/>}/>
    <Route path="/onboarding" element={account ? <Onboarding key={account.id} initial={profile ?? defaultProfile(account.id, account.nickname)} onSave={storeProfile} editing={completed}/> : <Navigate to="/welcome" replace/>}/>
    <Route path="/app/*" element={!account ? <Navigate to="/welcome" replace/> : !completed ? <Navigate to="/onboarding" replace/> : <Shell account={account} profile={profile!} onSwitch={switchUser} onDeleted={afterDelete}/>}/>
    <Route path="*" element={<Navigate to={completed ? '/app' : account ? '/onboarding' : '/'} replace/>}/>
  </Routes>;
}
