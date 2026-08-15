import { config } from '../config';

/** 将相对路径或完整 URL 解析为可加载的图片地址 */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  // 已是完整 URL（http/https/data:）
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  // 相对路径 → 拼接 API 基础地址
  return `${config.apiBaseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}