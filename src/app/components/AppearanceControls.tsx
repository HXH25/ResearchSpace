import { Languages, Palette } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { THEMES, setUiPreferences, useUiPreferences, type ThemeId, type UiLocale } from '@/app/preferences/store';

const names: Record<ThemeId, string> = { forest: '森林绿', ocean: '海洋蓝', violet: '鸢尾紫', rose: '玫瑰粉', amber: '暖琥珀' };

/** Native selects retain keyboard, screen-reader and mobile picker support. */
export function AppearanceControls({ expanded = false }: { expanded?: boolean }) {
  const { t } = useI18n();
  const { theme, locale } = useUiPreferences();
  if (expanded) return <div className="appearance-options">
    <fieldset className="theme-fieldset"><legend>{t('主题颜色')}</legend>
      <div className="theme-options">{THEMES.map((id) => <button type="button" key={id}
        aria-pressed={theme === id} className={`theme-option ${theme === id ? 'is-selected' : ''}`}
        onClick={() => setUiPreferences({ theme: id })}>
        <span className={`theme-swatch theme-swatch-${id}`} aria-hidden="true">{theme === id ? '✓' : ''}</span>
        <span>{t(names[id])}</span>
      </button>)}</div>
    </fieldset>
    <label className="language-setting"><span>{t('界面语言')}</span>
      <select className="input" value={locale} onChange={(event) => setUiPreferences({ locale: event.target.value as UiLocale })}>
        <option value="zh-CN">简体中文</option><option value="en">English</option>
      </select>
    </label>
    <p className="muted-hint">{t('设置立即生效，并保存在当前浏览器。界面语言不会修改你的个人资料或科研信息语言偏好。')}</p>
    <p className="muted-hint">{t('字体优先使用微软雅黑；未安装时使用系统中文无衬线字体。')}</p>
  </div>;
  return <div className="appearance-controls" role="group" aria-label={t('外观与语言')}>
    <label className="compact-select"><Palette size={16} aria-hidden="true"/>
      <select value={theme} aria-label={t('主题颜色')} onChange={(event) => setUiPreferences({ theme: event.target.value as ThemeId })}>
        {THEMES.map((id) => <option key={id} value={id}>{t(names[id])}</option>)}
      </select>
    </label>
    <label className="compact-select"><Languages size={16} aria-hidden="true"/>
      <select value={locale} aria-label={t('界面语言')} onChange={(event) => setUiPreferences({ locale: event.target.value as UiLocale })}>
        <option value="zh-CN">中文</option><option value="en">English</option>
      </select>
    </label>
  </div>;
}
