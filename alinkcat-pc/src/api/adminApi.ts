import { apiFetch } from './client';
import type {
  ApiResponse, PageResult, ThemeItem, TicketItem,
  ReviewActionParams,
} from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const adminApi = {
  // Theme review
  pendingThemes: (params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<ThemeItem>>>(`/api/admin/theme/pending${qs(params || {})}`),
  reviewTheme: (p: ReviewActionParams) =>
    apiFetch<ApiResponse<void>>(`/api/admin/theme/${p.themeId}/review`, { method: 'POST', body: { action: p.action, comment: p.comment } }),

  // Ticket management
  allTickets: (params?: { page?: number; size?: number; status?: number }) =>
    apiFetch<ApiResponse<PageResult<TicketItem>>>(`/api/admin/ticket/list${qs(params || {})}`),
  replyTicket: (id: number, content: string) =>
    apiFetch<ApiResponse<void>>(`/api/admin/ticket/${id}/reply`, { method: 'POST', body: { content } }),

  // Dashboard stats
  stats: () =>
    apiFetch<ApiResponse<{
      userCount: number; themeCount: number; pendingReview: number;
      openTickets: number; totalDownloads: number;
    }>>('/api/admin/stats'),
};