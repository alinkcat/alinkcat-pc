import { apiFetch } from './client';
import type { ApiResponse, UserProfileData, UpdateProfileParams, ChangePasswordParams } from './types';

export const userApi = {
  getProfile: () =>
    apiFetch<ApiResponse<UserProfileData>>('/api/user/profile'),
  updateProfile: (p: UpdateProfileParams) =>
    apiFetch<ApiResponse<UserProfileData>>('/api/user/profile', { method: 'PUT', body: p }),
  changePassword: (p: ChangePasswordParams) =>
    apiFetch<ApiResponse<void>>('/api/user/password', { method: 'PUT', body: p }),
};
