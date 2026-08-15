import { create } from 'zustand';
import { themeApi } from '../api/themeApi';
import type { ThemeItem } from '../api/types';

type SortField = 'createdAt' | 'viewCount' | 'downloadCount' | 'rating';

interface MarketState {
  list: ThemeItem[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  category: string;
  sortBy: SortField;
  sortOrder: string;
  loading: boolean;

  setSearch: (v: string) => void;
  setCategory: (v: string) => void;
  setSort: (v: SortField) => void;
  setPage: (p: number) => void;
  fetchList: () => Promise<void>;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  list: [],
  total: 0,
  page: 1,
  pageSize: 12,
  search: '',
  category: '',
  sortBy: 'downloadCount',
  sortOrder: 'desc',
  loading: false,

  setSearch: (v) => { set({ search: v, page: 1 }); get().fetchList(); },
  setCategory: (v) => { set({ category: v, page: 1 }); get().fetchList(); },
  setSort: (v) => { set({ sortBy: v, page: 1 }); get().fetchList(); },
  setPage: (p) => { set({ page: p }); get().fetchList(); },

  fetchList: async () => {
    const { search, category, sortBy, sortOrder, page, pageSize } = get();
    set({ loading: true });
    try {
      const resp = await themeApi.list({
        page, size: pageSize,
        keyword: search || undefined,
        category: category || undefined,
        sortBy,
        sortOrder,
        status: 1,
      });
      if (resp.code === 200 && resp.data) {
        set({ list: resp.data.records, total: resp.data.total });
      }
    } catch (e) { console.error('[Market] fetchList error:', e); }
    finally { set({ loading: false }); }
  },
}));
