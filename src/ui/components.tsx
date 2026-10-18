import { translate as t } from '@/app/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, ArrowRight, Orbit, LockKeyhole, MoveUpRight } from 'lucide-react';
import type { AvatarTone } from '@/app/services/db';
export function Brand({ compact = false, dark = false }: {
    compact?: boolean;
    dark?: boolean;
}) {
    return <Link className={`brand ${dark ? 'brand-light' : ''}`} to="/">
    <span className="brand-emblem"><Orbit size={21} strokeWidth={2.3}/></span>
    {!compact && <span className="brand-wordmark">Research<span>Space</span><small>{t("本科生科研空间")}</small></span>}
  </Link>;
}
export function Avatar({ name, tone = 'mint', size = 'md' }: {
    name: string;
    tone?: AvatarTone;
    size?: 'sm' | 'md' | 'lg';
}) {
    return <span className={`avatar avatar-${tone} avatar-${size}`}>{name.slice(0, 2).toUpperCase()}</span>;
}
export function Pill({ children, tone = 'light' }: {
    children: ReactNode;
    tone?: 'light' | 'green' | 'gray' | 'blue' | 'amber';
}) {
    return <span className={`pill pill-${tone}`}>{children}</span>;
}
export function SectionEyebrow({ children }: {
    children: ReactNode;
}) {
    return <div className="section-eyebrow">{children}</div>;
}
export function EmptyModuleMark({ id }: {
    id: string;
}) {
    return <div className={`module-mark module-${id}`}><BookOpenText size={28}/></div>;
}
export function Footer() {
    return <footer className="site-footer"><span>{t("ResearchSpace \u00B7 每一种好奇，都值得一次尝试。")}</span><span className="footer-privacy"><LockKeyhole size={14}/>{t("本地资料保存在当前浏览器")}</span></footer>;
}
export function PageHeading({ eyebrow, title, description, children }: {
    eyebrow: string;
    title: string;
    description?: string;
    children?: ReactNode;
}) {
    return <div className="page-heading">
    <div><SectionEyebrow>{eyebrow}</SectionEyebrow><h1>{t(title)}</h1>{description && <p>{t(description)}</p>}</div>
    {children}
  </div>;
}
export function ArrowLink({ to, children }: {
    to: string;
    children: ReactNode;
}) {
    return <Link to={to} className="arrow-link">{children}<ArrowRight size={16}/></Link>;
}
export function ExternalLink({ href, children }: {
    href: string;
    children: ReactNode;
}) {
    return <a className="external-link" href={href} target="_blank" rel="noreferrer noopener">{children}<MoveUpRight size={14}/></a>;
}
