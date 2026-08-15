import { apiFetch } from './client';
import type { ApiResponse, MemberPlan, MemberInfo, OrderCreateParams, PaymentOrder, PageResult, MemberBenefits, BenefitsComparison } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const memberApi = {
  plans: () =>
    apiFetch<ApiResponse<MemberPlan[]>>('/api/member/plans'),
  my: () =>
    apiFetch<ApiResponse<MemberInfo>>('/api/member/my'),
  myBenefits: () =>
    apiFetch<ApiResponse<MemberBenefits>>('/api/member/my/benefits'),
  benefitsComparison: () =>
    apiFetch<ApiResponse<BenefitsComparison>>('/api/member/benefits'),
  createOrder: (p: OrderCreateParams) =>
    apiFetch<ApiResponse<PaymentOrder>>('/api/member/order/create', { method: 'POST', body: p }),
  myOrders: (params?: { page?: number; size?: number }) =>
    apiFetch<ApiResponse<PageResult<PaymentOrder>>>(`/api/member/my/orders${qs(params || {})}`),
  redeemCard: (code: string) =>
    apiFetch<ApiResponse<void>>('/api/member/card/redeem', { method: 'POST', body: { code } }),
};
