import { apiFetch } from './client';
import type { ApiResponse, NotificationItem, PageResult } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const notificationApi = {
  list: (params?: { page?: number; size?: number; type?: string }) =>
    apiFetch<ApiResponse<PageResult<NotificationItem>>>(`/api/notification/list${qs(params || {})}`),
  unreadCount: () =>
    apiFetch<ApiResponse<number>>('/api/notification/unread-count'),
  read: (id: number) =>
    apiFetch<ApiResponse<void>>(`/api/notification/${id}/read`, { method: 'PUT' }),
  readAll: () =>
    apiFetch<ApiResponse<void>>('/api/notification/read-all', { method: 'PUT' }),
};