import { config } from '../config';

/** resolve a relative path or full URL into a loadable image address */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  // already absolute (http/https/data:/blob:)
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  // relative → prefix with the API base
  return `${config.apiBaseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}