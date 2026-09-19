import i18n from '../i18n/setup';

export type ThemeSource = 'local' | 'downloaded';

/** determine the theme source */
export function getThemeSource(t: { source?: string; market_id?: string }): ThemeSource {
  return t.source === 'downloaded' ? 'downloaded' : 'local';
}

/** source label text */
export function sourceLabel(source: ThemeSource): string {
  return source === 'downloaded' ? i18n.t('themes.sourceDownloaded') : i18n.t('themes.sourceLocal');
}

/** source label color (local green / download blue) */
export function sourceTagColor(source: ThemeSource): string {
  return source === 'downloaded' ? 'blue' : 'green';
}
