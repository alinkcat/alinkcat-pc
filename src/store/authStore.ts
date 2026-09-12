import { create } from 'zustand';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { setTokens, clearTokens, getAccessToken, resetAuthExpiredFlag } from '../api/client';
import { getDeviceInfo } from '../utils/deviceInfo';
import type { LoginResult, UserProfileData } from '../api/types';

interface AuthState {
  user: LoginResult | null;
  profile: UserProfileData | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, extra?: { email?: string; phone?: string; nickname?: string; verificationCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  hydrate: () => void;
  /** OAuth 登录成功后应用令牌并同步登录状态（无需 user 对象，profile 会补充） */
  applyTokens: (accessToken: string, refreshToken?: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoggedIn: !!getAccessToken(),

  loading: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const resp = await authApi.login({
        username, password,
        ...(await getDeviceInfo()),
      });
      if (resp.code !== 200) throw new Error(resp.message);
      const user = resp.data;
      setTokens(user.accessToken, user.refreshToken);
      resetAuthExpiredFlag(); // 重新登录后允许再次触发"登录过期"提示
      set({ user, isLoggedIn: true, loading: false });
      // auto-fetch profile
      get().fetchProfile().catch(() => {});
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  register: async (username, password, extra) => {
    set({ loading: true });
    try {
      const resp = await authApi.register({
        username, password,
        email: extra?.email,
        phone: extra?.phone,
        nickname: extra?.nickname,
        verificationCode: extra?.verificationCode,
      });
      if (resp.code !== 200) throw new Error(resp.message);
      set({ loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearTokens();
    set({ user: null, profile: null, isLoggedIn: false });
  },

  fetchProfile: async () => {
    if (!getAccessToken()) return;
    try {
      const resp = await userApi.getProfile();
      if (resp.code === 200 && resp.data) {
        set({ profile: resp.data });
      } else if (resp.code === 401) {
        // 明确的鉴权失败：清 token 登出（apiFetch 已触发 auth:expired）
        console.warn('[Auth] fetchProfile 401, logging out:', resp.message);
        clearTokens();
        set({ user: null, profile: null, isLoggedIn: false });
      }
      // 其它非 2xx（如后端 5xx）仅保留异常，不清 token，避免网络抖动导致误登出
    } catch (e) {
      // 网络/解析错误：不清 token、不登出；仅在 401 场景由上方分支处理
      console.warn('[Auth] fetchProfile failed (kept session):', e);
    }
  },

  hydrate: () => {
    set({ isLoggedIn: !!getAccessToken() });
    if (getAccessToken()) get().fetchProfile().catch(() => {});
  },

  applyTokens: async (accessToken, refreshToken) => {
    if (!accessToken) return false;
    setTokens(accessToken, refreshToken || '');
    resetAuthExpiredFlag();
    set({ isLoggedIn: true, user: null, loading: false });
    // 拉取 profile：成功返回 true；失败不强制登出（网络抖动等），仍视为已登录
    try {
      await get().fetchProfile();
      return true;
    } catch {
      return true;
    }
  },
}));
