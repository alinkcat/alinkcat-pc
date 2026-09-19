import { create } from 'zustand';
import { memberApi } from '../api/memberApi';
import type { MemberPlan, MemberInfo, PaymentOrder, MemberBenefits, BenefitsComparison } from '../api/types';

interface MemberState {
  plans: MemberPlan[];
  member: MemberInfo | null;
  myBenefits: MemberBenefits | null;
  comparison: BenefitsComparison | null;
  orders: PaymentOrder[];
  loading: boolean;
  fetchPlans: () => Promise<void>;
  fetchMy: () => Promise<void>;
  fetchMyBenefits: () => Promise<void>;
  fetchComparison: () => Promise<void>;
  fetchOrders: (params?: { page?: number; size?: number }) => Promise<{ total: number }>;
  createOrder: (planId: number, method: string) => Promise<PaymentOrder>;
  redeemCard: (code: string) => Promise<void>;
}

export const useMemberStore = create<MemberState>((set) => ({
  plans: [], member: null, myBenefits: null, comparison: null, orders: [], loading: false,

  fetchPlans: async () => {
    set({ loading: true });
    try {
      const resp = await memberApi.plans();
      if (resp.code === 200) set({ plans: resp.data });
    } finally { set({ loading: false }); }
  },
  fetchMy: async () => {
    try {
      const resp = await memberApi.my();
      if (resp.code === 200) set({ member: resp.data });
    } catch { set({ member: null }); }
  },
  fetchMyBenefits: async () => {
    try {
      const resp = await memberApi.myBenefits();
      if (resp.code === 200) set({ myBenefits: resp.data });
    } catch { set({ myBenefits: null }); }
  },
  fetchComparison: async () => {
    try {
      const resp = await memberApi.benefitsComparison();
      if (resp.code === 200) set({ comparison: resp.data });
    } catch { /* ignore */ }
  },
  fetchOrders: async (params) => {
    const resp = await memberApi.myOrders({ page: 1, size: 20, ...params });
    if (resp.code === 200) { set({ orders: resp.data.records }); return { total: resp.data.total }; }
    return { total: 0 };
  },
  createOrder: async (planId, method) => {
    const resp = await memberApi.createOrder({ planId, method });
    if (resp.code !== 200) throw new Error(resp.message);
    return resp.data;
  },
  redeemCard: async (code) => {
    const resp = await memberApi.redeemCard(code);
    if (resp.code !== 200) throw new Error(resp.message);
    const m = await memberApi.my();
    if (m.code === 200) set({ member: m.data });
  },
}));
