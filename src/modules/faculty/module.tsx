import { Route, Routes } from 'react-router-dom';
import { CONTRACT_VERSION } from '@/sdk/contracts';
import type { ModulePageProps, ResearchModule } from '@/sdk/contracts';
import { SearchPage } from './components/SearchPage';
import { DetailPage } from './components/DetailPage';
import { useShortlist } from './useShortlist';
import './styles.css';

function FacultySession(props: ModulePageProps) {
  const shortlist = useShortlist(props.api.storage);
  return <div className="rs-faculty"><Routes>
    <Route index element={<SearchPage {...props} shortlist={shortlist} />} />
    <Route path=":facultyId" element={<DetailPage {...props} shortlist={shortlist} />} />
    <Route path="*" element={<div className="rsf-state"><h1>未找到这个页面</h1><button className="rsf-button rsf-secondary" onClick={() => props.api.navigation.go('/app/faculty')}>返回导师搜索</button></div>} />
  </Routes></div>;
}
function FacultyRoot(props: ModulePageProps) { return <FacultySession key={props.profile.userId} {...props} />; }
const facultyModule: ResearchModule = {
  contractVersion: CONTRACT_VERSION, id: 'faculty', title: '导师探索',
  summary: '查询清华官网教师数据库与 OpenAlex 学术资料，依据真实画像准备下一步。',
  icon: 'graduation-cap', Root: FacultyRoot,
};
export default facultyModule;
