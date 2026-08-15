import { apiFetch, apiUpload } from './client';
import type { ApiResponse, CloudFile, CloudSpace, PageResult } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const cloudApi = {
  list: (params?: { page?: number; size?: number; category?: string }) =>
    apiFetch<ApiResponse<PageResult<CloudFile>>>(`/api/cloud/list${qs(params || {})}`),
  space: () =>
    apiFetch<ApiResponse<CloudSpace>>('/api/cloud/space'),
  upload: (formData: FormData) =>
    apiUpload<ApiResponse<CloudFile>>('/api/cloud/upload', formData),
  delete: (id: number) =>
    apiFetch<ApiResponse<void>>(`/api/cloud/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: number) =>
    apiFetch<ApiResponse<string>>(`/api/cloud/${id}/download-url`),
};