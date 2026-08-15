import { create } from 'zustand';
import { tauriInvoke } from '../utils/tauri';
import type { UploadRecord } from '../types/upload';

interface UploadState {
  records: UploadRecord[];
  loading: boolean;
  fetchRecords: () => Promise<void>;
}

export const useUploadStore = create<UploadState>((set) => ({
  records: [],
  loading: false,

  fetchRecords: async () => {
    set({ loading: true });
    try {
      const records = await tauriInvoke<UploadRecord[]>('get_upload_records');
      set({ records });
    } catch {
      set({ records: [] });
    } finally {
      set({ loading: false });
    }
  },
}));
