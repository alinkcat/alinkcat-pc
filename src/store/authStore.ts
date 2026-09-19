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
  /** on OAuth success, apply tokens and sync login state (no user object needed, profile will fill in) */
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
      resetAuthExpiredFlag(); // re-arm after re-login"auth expired"prompt
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
        // explicit auth failure：clear token and log out（apiFetch already triggered auth:expired）
        console.warn('[Auth] fetchProfile 401, logging out:', resp.message);
        clearTokens();
        set({ user: null, profile: null, isLoggedIn: false });
      }
      // other non-2xx (e.g. backend 5xx) keep the error, do not clear token, avoid accidental logout on network blips
    } catch (e) {
      // network/parse error：do not clear token、do not log out；only the 401 branch above handles it
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
    // fetch profile：return true on success；do not force logout on failure（network blips etc.），still treat as logged in
    try {
      await get().fetchProfile();
      return true;
    } catch {
      return true;
    }
  },
}));
