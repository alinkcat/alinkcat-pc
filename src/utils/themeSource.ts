import i18n from '../i18n/setup';

export type ThemeSource = 'local' | 'downloaded';

/** 判断主题包来源 */
export function getThemeSource(t: { source?: string; market_id?: string }): ThemeSource {
  return t.source === 'downloaded' ? 'downloaded' : 'local';
}

/** 来源标签文案 */
export function sourceLabel(source: ThemeSource): string {
  return source === 'downloaded' ? i18n.t('themes.sourceDownloaded') : i18n.t('themes.sourceLocal');
}

/** 来源标签颜色（本地绿 / 下载蓝） */
export function sourceTagColor(source: ThemeSource): string {
  return source === 'downloaded' ? 'blue' : 'green';
}
