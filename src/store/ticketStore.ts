import { create } from 'zustand';
import { ticketApi } from '../api/ticketApi';
import type { TicketItem, TicketReply } from '../api/types';

interface TicketState {
  tickets: TicketItem[];
  myTickets: TicketItem[];
  detail: TicketItem | null;
  replies: TicketReply[];
  loading: boolean;
  fetchList: (params?: { page?: number; size?: number; status?: number; keyword?: string }) => Promise<{ total: number }>;
  fetchMy: (params?: { page?: number; size?: number; status?: number }) => Promise<{ total: number }>;
  fetchDetail: (id: number) => Promise<void>;
  fetchReplies: (id: number) => Promise<void>;
  create: (params: { title: string; content: string; category?: string; priority?: number }) => Promise<void>;
  reply: (id: number, content: string) => Promise<void>;
}

export const useTicketStore = create<TicketState>((set) => ({
  tickets: [], myTickets: [], detail: null, replies: [], loading: false,

  fetchList: async (params) => {
    set({ loading: true });
    try {
      const resp = await ticketApi.list({ page: 1, size: 10, ...params });
      if (resp.code === 200) { set({ tickets: resp.data.records }); return { total: resp.data.total }; }
      return { total: 0 };
    } finally { set({ loading: false }); }
  },
  fetchMy: async (params) => {
    set({ loading: true });
    try {
      const resp = await ticketApi.my({ page: 1, size: 10, ...params });
      if (resp.code === 200) { set({ myTickets: resp.data.records }); return { total: resp.data.total }; }
      return { total: 0 };
    } finally { set({ loading: false }); }
  },
  fetchDetail: async (id) => {
    const resp = await ticketApi.detail(id);
    if (resp.code === 200) set({ detail: resp.data });
  },
  fetchReplies: async (id) => {
    const resp = await ticketApi.replies(id);
    if (resp.code === 200) set({ replies: resp.data });
  },
  create: async (params) => {
    const resp = await ticketApi.create(params);
    if (resp.code !== 200) throw new Error(resp.message);
  },
  reply: async (id, content) => {
    const resp = await ticketApi.reply(id, content);
    if (resp.code !== 200) throw new Error(resp.message);
  },
}));
