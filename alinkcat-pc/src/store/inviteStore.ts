import { create } from 'zustand';
import { inviteApi } from '../api/inviteApi';
import type { InviteCode, InviteRecord } from '../api/types';

interface InviteState {
  code: InviteCode | null;
  records: InviteRecord[];
  loading: boolean;
  fetchCode: () => Promise<void>;
  fetchRecords: () => Promise<void>;
  generateCode: () => Promise<InviteCode>;
  bindCode: (code: string) => Promise<void>;
}

export const useInviteStore = create<InviteState>((set) => ({
  code: null, records: [], loading: false,

  fetchCode: async () => {
    set({ loading: true });
    try {
      const resp = await inviteApi.myCode();
      if (resp.code === 200 && resp.data) set({ code: resp.data });
    } catch { set({ code: null }); }
    finally { set({ loading: false }); }
  },
  fetchRecords: async () => {
    try {
      const resp = await inviteApi.myRecords();
      if (resp.code === 200 && resp.data) set({ records: resp.data });
    } catch { set({ records: [] }); }
  },
  generateCode: async () => {
    const resp = await inviteApi.generate();
    if (resp.code !== 200 || !resp.data) throw new Error(resp.message);
    set({ code: resp.data });
    return resp.data;
  },
  bindCode: async (code) => {
    const resp = await inviteApi.register(code);
    if (resp.code !== 200) throw new Error(resp.message);
  },
}));
