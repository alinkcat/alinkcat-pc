import { apiFetch } from './client';
import type { ApiResponse, TicketItem, TicketCreateParams, TicketReply, PageResult } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const ticketApi = {
  create: (p: TicketCreateParams) =>
    apiFetch<ApiResponse<TicketItem>>('/api/ticket', { method: 'POST', body: p }),
  list: (params?: { page?: number; size?: number; status?: number; keyword?: string }) =>
    apiFetch<ApiResponse<PageResult<TicketItem>>>(`/api/ticket/list${qs(params || {})}`),
  my: (params?: { page?: number; size?: number; status?: number }) =>
    apiFetch<ApiResponse<PageResult<TicketItem>>>(`/api/ticket/my${qs(params || {})}`),
  detail: (id: number) =>
    apiFetch<ApiResponse<TicketItem>>(`/api/ticket/${id}`),
  reply: (id: number, content: string, images?: string) =>
    apiFetch<ApiResponse<void>>(`/api/ticket/${id}/reply`, { method: 'POST', body: { content, images } }),
  replies: (id: number) =>
    apiFetch<ApiResponse<TicketReply[]>>(`/api/ticket/${id}/replies`),
};
