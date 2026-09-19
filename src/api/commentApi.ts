import { apiFetch } from './client';
import type { ApiResponse, PageResult, ThemeComment } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const commentApi = {
  list: (themeId: string, params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<ThemeComment>>>(`/api/theme/${themeId}/comments${qs(params || {})}`),
  replies: (themeId: string, parentId: number, params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<ThemeComment>>>(`/api/theme/${themeId}/comments/${parentId}/replies${qs(params || {})}`),
  create: (themeId: string, content: string, parentId?: number) =>
    apiFetch<ApiResponse<ThemeComment>>(`/api/theme/${themeId}/comments`, {
      method: 'POST', body: { content, parentId: parentId || 0 },
    }),
};