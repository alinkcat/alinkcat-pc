import { apiFetch, apiUpload } from './client';
import type { ApiResponse, PageResult, ThemeItem, ThemeListParams, FavoriteStatus } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const themeApi = {
  list: (params?: ThemeListParams) =>
    apiFetch<ApiResponse<PageResult<ThemeItem>>>(`/api/theme/list${qs((params || {}) as Record<string, unknown>)}`),
  detail: (id: number) =>
    apiFetch<ApiResponse<ThemeItem>>(`/api/theme/${id}`),
  screenshots: (id: number) =>
    apiFetch<ApiResponse<string[]>>(`/api/theme/${id}/screenshots`),
  download: (id: number) =>
    apiFetch<ApiResponse<void>>(`/api/theme/${id}/download`, { method: 'POST' }),
  my: (params?: ThemeListParams) =>
    apiFetch<ApiResponse<PageResult<ThemeItem>>>(`/api/theme/my${qs((params || {}) as Record<string, unknown>)}`),
  upload: (formData: FormData) =>
    apiUpload<ApiResponse<ThemeItem>>('/api/theme/upload', formData),
  delete: (id: number) =>
    apiFetch<ApiResponse<void>>(`/api/theme/${id}`, { method: 'DELETE' }),
  favorite: (themeId: string) =>
    apiFetch<ApiResponse<void>>(`/api/theme/${themeId}/favorite`, { method: 'POST' }),
  favoriteStatus: (themeId: string) =>
    apiFetch<ApiResponse<FavoriteStatus>>(`/api/theme/${themeId}/favorite/status`),
  favorites: (params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<ThemeItem>>>(`/api/theme/favorites${qs((params || {}) as Record<string, unknown>)}`),
  rate: (themeId: string, rating: number) =>
    apiFetch<ApiResponse<void>>(`/api/theme/${themeId}/rate`, { method: 'POST', body: { rating } }),
};
