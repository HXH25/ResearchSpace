import type { ReactNode } from 'react';
import { ArrowUpRight, Bookmark, LoaderCircle } from 'lucide-react';
import type { EvidenceSource, FacultyRecord } from '@/sdk/contracts';
import { safeUrl, statusLabels } from '../domain';
import type { Shortlist } from '../useShortlist';

export function DateLabel({ value }: { value?: string }) {
  if (!value || Number.isNaN(Date.parse(value))) return <>日期未提供</>;
  return <time dateTime={value}>{value.slice(0, 10)}</time>;
}
export function SourceLink({ url, children, demo = false }: { url?: string; children: ReactNode; demo?: boolean }) {
  const safe = safeUrl(url);
  return safe && !demo ? <a href={safe} target="_blank" rel="noopener noreferrer" className="rsf-source-link">{children}<ArrowUpRight size={13} aria-hidden="true" /></a> : <span>{children}{demo && '（演示占位，无真实链接）'}</span>;
}
export function DemoNotice() {
  return <div className="rsf-demo" role="note"><strong>演示数据 · 全部为虚构人物与资料</strong><span>仅用于体验搜索流程，不代表真实清华教师、论文或科研机会。真实资料尚未接入。</span></div>;
}
export function StatusBadge({ faculty }: { faculty: FacultyRecord }) {
  return <span className={`rsf-badge rsf-status-${faculty.recruitmentStatus}`}>{faculty.isDemo ? '演示状态 · ' : ''}{statusLabels[faculty.recruitmentStatus]}</span>;
}
export function Loading({ label = '正在整理导师资料…' }: { label?: string }) {
  return <div className="rsf-state" role="status"><LoaderCircle className="rsf-spin" size={24} aria-hidden="true" /><p>{label}</p></div>;
}
export function Empty({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return <div className="rsf-state"><h2>{title}</h2><p>{message}</p>{children}</div>;
}
export function Failure({ message, retry }: { message: string; retry: () => void }) {
  return <div className="rsf-state rsf-error" role="alert"><h2>这次暂时没有加载成功</h2><p>{message}</p><button className="rsf-button rsf-secondary" onClick={retry}>重试加载</button></div>;
}
export function SaveButton({ id, name, shortlist }: { id: string; name: string; shortlist: Shortlist }) {
  const saved = Boolean(shortlist.entries[id]?.saved);
  return <button className={`rsf-button rsf-save ${saved ? 'is-saved' : ''}`} aria-label={`${saved ? '取消收藏' : '收藏'}${name}`} aria-pressed={saved}
    disabled={shortlist.loading || shortlist.busy || Boolean(shortlist.error)} onClick={() => void shortlist.update(id, { saved: !saved })}>
    <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? '已收藏' : '收藏'}</button>;
}
export function StorageNotice({ shortlist }: { shortlist: Shortlist }) {
  return shortlist.error ? <div className="rsf-notice rsf-error" role="alert">{shortlist.error}<button className="rsf-link-button" onClick={shortlist.retry}>重试读取</button></div> : null;
}
export function Evidence({ sources, ids }: { sources: EvidenceSource[]; ids?: string[] }) {
  const selected = ids ? sources.filter(source => ids.includes(source.id)) : sources;
  if (!selected.length) return <p className="rsf-muted">尚无对应来源，相关信息未核实。</p>;
  return <ul className="rsf-evidence">{selected.map(source => <li key={source.id}>
    <SourceLink url={source.url} demo={source.type === 'mock'}>{source.title}</SourceLink>
    <small>{source.publisher && `${source.publisher} · `}{source.type === 'mock' ? '演示资料日期' : '访问日期'}：<DateLabel value={source.accessedAt} />{source.publishedAt && <> · 发布：<DateLabel value={source.publishedAt} /></>}</small>
    {source.note && <small>{source.note}</small>}
  </li>)}</ul>;
}
