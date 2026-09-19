import { apiFetch } from './client';
import type {
  ApiResponse, LoginParams, LoginResult, RegisterParams, RefreshParams,
  RegisterStatus, SendCodeParams, OAuthLoginResult, OAuthTokenParams, OAuthBindStatus,
} from './types';

export const authApi = {
  login: (p: LoginParams) =>
    apiFetch<ApiResponse<LoginResult>>('/api/auth/login', { method: 'POST', body: p }),
  register: (p: RegisterParams) =>
    apiFetch<ApiResponse<void>>('/api/auth/register', { method: 'POST', body: p }),
  refresh: (p: RefreshParams) =>
    apiFetch<ApiResponse<LoginResult>>('/api/auth/refresh', { method: 'POST', body: p }),
  logout: () =>
    apiFetch<ApiResponse<void>>('/api/auth/logout', { method: 'POST' }),
  registerStatus: () =>
    apiFetch<ApiResponse<RegisterStatus>>('/api/auth/register/status'),
  sendRegisterCode: (p: SendCodeParams) =>
    apiFetch<ApiResponse<void>>('/api/auth/send-register-code', { method: 'POST', body: p }),
  // GitHub OAuth (API mode, per docs)
  oauthCheck: () =>
    apiFetch<ApiResponse<void>>('/api/auth/oauth/check'),
  oauthLogin: () =>
    apiFetch<ApiResponse<OAuthLoginResult>>('/api/auth/oauth/login'),
  oauthToken: (p: OAuthTokenParams) =>
    apiFetch<ApiResponse<LoginResult>>('/api/auth/oauth/token', { method: 'POST', body: p }),
  oauthBindStatus: () =>
    apiFetch<ApiResponse<OAuthBindStatus>>('/api/auth/oauth/bind/status'),
  oauthBind: () =>
    apiFetch<ApiResponse<OAuthLoginResult>>('/api/auth/oauth/bind', { method: 'POST' }),
  oauthUnbind: () =>
    apiFetch<ApiResponse<void>>('/api/auth/oauth/bind', { method: 'DELETE' }),
};
