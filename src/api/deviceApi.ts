import { apiFetch } from './client';
import type { ApiResponse, PageResult, UserDevice } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const deviceApi = {
  my: (params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<UserDevice>>>(`/api/device/my${qs(params || {})}`),
};
