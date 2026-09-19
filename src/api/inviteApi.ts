import { apiFetch } from './client';
import type { ApiResponse, InviteCode, InviteRecord } from './types';

export const inviteApi = {
  myCode: () =>
    apiFetch<ApiResponse<InviteCode>>('/api/invite/my-code'),
  generate: () =>
    apiFetch<ApiResponse<InviteCode>>('/api/invite/generate', { method: 'POST' }),
  myRecords: () =>
    apiFetch<ApiResponse<InviteRecord[]>>('/api/invite/my-records'),
  register: (code: string) =>
    apiFetch<ApiResponse<void>>('/api/invite/register', { method: 'POST', body: { code } }),
};
