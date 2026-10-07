import { create } from 'zustand';
import { notificationApi } from '../api/notificationApi';
import type { NotificationItem } from '../api/types';

interface NotificationState {
  list: NotificationItem[];
  unread: number;
  loading: boolean;
  fetchList: (params?: { page?: number; size?: number; type?: string }) => Promise<{ total: number }>;
  fetchUnread: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  list: [], unread: 0, loading: false,

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const resp = await notificationApi.list({ page: 1, size: 20, ...params });
      if (resp.code === 200 && resp.data) {
        set({ list: resp.data.records });
        return { total: resp.data.total };
      }
      return { total: 0 };
    } finally { set({ loading: false }); }
  },

  fetchUnread: async () => {
    try {
      const resp = await notificationApi.unreadCount();
      if (resp.code === 200) set({ unread: resp.data });
    } catch { /* ignore */ }
  },

  markRead: async (id) => {
    await notificationApi.read(id);
    set((s) => ({ unread: Math.max(0, s.unread - 1), list: s.list.map((n) => n.id === id ? { ...n, isRead: 1 } : n) }));
  },

  markAllRead: async () => {
    await notificationApi.readAll();
    set({ unread: 0, list: [] });
    // Re-fetch to get updated list
    const resp = await notificationApi.list({ page: 1, size: 20 });
    if (resp.code === 200 && resp.data) set({ list: resp.data.records });
  },
}));