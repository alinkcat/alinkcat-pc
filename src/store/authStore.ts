import { create } from 'zustand';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { setTokens, clearTokens, getAccessToken } from '../api/client';
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
      } else {
        // Token invalid or user deleted — auto logout
        console.warn('[Auth] fetchProfile failed, logging out:', resp.message);
        clearTokens();
        set({ user: null, profile: null, isLoggedIn: false });
      }
    } catch (e) {
      console.error('[Auth] fetchProfile failed:', e);
      clearTokens();
      set({ user: null, profile: null, isLoggedIn: false });
    }
  },

  hydrate: () => {
    set({ isLoggedIn: !!getAccessToken() });
    if (getAccessToken()) get().fetchProfile().catch(() => {});
  },
}));
