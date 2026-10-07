import i18n from '../i18n/setup';

export type ThemeSource = 'local' | 'downloaded';

/** figure out where a theme pack came from */
export function getThemeSource(t: { source?: string; market_id?: string }): ThemeSource {
  return t.source === 'downloaded' ? 'downloaded' : 'local';
}

/** label text for the source tag */
export function sourceLabel(source: ThemeSource): string {
  return source === 'downloaded' ? i18n.t('themes.sourceDownloaded') : i18n.t('themes.sourceLocal');
}

/** tag color (local=green, downloaded=blue) */
export function sourceTagColor(source: ThemeSource): string {
  return source === 'downloaded' ? 'blue' : 'green';
}
