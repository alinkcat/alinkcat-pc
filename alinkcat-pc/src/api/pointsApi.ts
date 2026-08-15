import { apiFetch } from './client';
import type {
  ApiResponse, PointsBalance, PointsRecord, PageResult,
  PointsCheckinResult, PointsExchangeParams, PointsExchangeResult,
  PointsRule, PointsRankItem, PointsMallItem, PointsExchangeRecord,
} from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const pointsApi = {
  balance: () =>
    apiFetch<ApiResponse<PointsBalance>>('/api/points/balance'),
  records: (params?: { page?: number; size?: number; type?: number }) =>
    apiFetch<ApiResponse<PageResult<PointsRecord>>>(`/api/points/records${qs(params || {})}`),
  checkin: () =>
    apiFetch<ApiResponse<PointsCheckinResult>>('/api/points/checkin', { method: 'POST' }),
  exchange: (p: PointsExchangeParams) =>
    apiFetch<ApiResponse<PointsExchangeResult>>('/api/points/exchange', { method: 'POST', body: p }),
  exchangeHistory: (params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<PointsExchangeRecord>>>(`/api/points/exchange/history${qs(params || {})}`),
  rules: () =>
    apiFetch<ApiResponse<PointsRule[]>>('/api/points/rules'),
  rank: (limit?: number) =>
    apiFetch<ApiResponse<PointsRankItem[]>>(`/api/points/rank${limit ? `?limit=${limit}` : ''}`),
  mallList: (params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<PointsMallItem>>>(`/api/points/mall/list${qs(params || {})}`),
};
