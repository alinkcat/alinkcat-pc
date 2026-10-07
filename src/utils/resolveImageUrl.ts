import { config } from '../config';

/** resolve a relative path or full URL to a loadable image address */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  // already a full URL（http/https/data:）
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  // relative path → join with API base URL
  return `${config.apiBaseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}