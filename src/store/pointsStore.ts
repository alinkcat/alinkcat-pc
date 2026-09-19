import { create } from 'zustand';
import { pointsApi } from '../api/pointsApi';
import type {
  PointsBalance, PointsRecord, PointsCheckinResult,
  PointsExchangeResult, PointsRule, PointsRankItem, PointsMallItem,
} from '../api/types';

interface PointsState {
  balance: PointsBalance | null;
  records: PointsRecord[];
  rules: PointsRule[];
  rank: PointsRankItem[];
  mallItems: PointsMallItem[];
  loading: boolean;
  fetchBalance: () => Promise<void>;
  fetchRecords: (params?: { page?: number; size?: number; type?: number }) => Promise<{ total: number }>;
  fetchRules: () => Promise<void>;
  fetchRank: (limit?: number) => Promise<void>;
  fetchMall: (params?: { page?: number; size?: number }) => Promise<{ total: number }>;
  checkin: () => Promise<PointsCheckinResult>;
  exchange: (exchangeType: number, targetId?: number | null) => Promise<PointsExchangeResult>;
}

export const usePointsStore = create<PointsState>((set) => ({
  balance: null, records: [], rules: [], rank: [], mallItems: [], loading: false,

  fetchBalance: async () => {
    set({ loading: true });
    try {
      const resp = await pointsApi.balance();
      if (resp.code === 200) set({ balance: resp.data });
    } finally { set({ loading: false }); }
  },
  fetchRecords: async (params) => {
    const resp = await pointsApi.records({ page: 1, size: 20, ...params });
    if (resp.code === 200) { set({ records: resp.data.records }); return { total: resp.data.total }; }
    return { total: 0 };
  },
  fetchRules: async () => {
    const resp = await pointsApi.rules();
    if (resp.code === 200) set({ rules: resp.data });
  },
  fetchRank: async (limit = 10) => {
    const resp = await pointsApi.rank(limit);
    if (resp.code === 200) set({ rank: resp.data });
  },
  fetchMall: async (params) => {
    const resp = await pointsApi.mallList({ page: 1, size: 20, ...params });
    if (resp.code === 200) { set({ mallItems: resp.data.records }); return { total: resp.data.total }; }
    return { total: 0 };
  },
  checkin: async () => {
    const resp = await pointsApi.checkin();
    if (resp.code !== 200) throw new Error(resp.message);
    const b = await pointsApi.balance();
    if (b.code === 200) set({ balance: b.data });
    return resp.data;
  },
  exchange: async (exchangeType, targetId = null) => {
    const resp = await pointsApi.exchange({ exchangeType, targetId });
    if (resp.code !== 200) throw new Error(resp.message);
    return resp.data;
  },
}));
