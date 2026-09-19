import { create } from 'zustand';
import { tauriInvoke } from '../utils/tauri';

interface ServerStatusState {
  running: boolean;
  port: number;
  deviceCount: number;
  fetchStatus: () => Promise<void>;
  setRunning: (running: boolean) => void;
  refresh: () => Promise<void>;
}

export const useServerStatusStore = create<ServerStatusState>((set) => ({
  running: false,
  port: 9527,
  deviceCount: 0,

  fetchStatus: async () => {
    try {
      const st = await tauriInvoke<{ running: boolean; port: number }>('get_server_status');
      set({ running: st.running, port: st.port });
    } catch {
      set({ running: false });
    }
    try {
      const conns = await tauriInvoke<unknown[]>('get_connections');
      set({ deviceCount: conns.length });
    } catch { /* ignore */ }
  },

  setRunning: (running) => set({ running }),

  refresh: async () => {
    try {
      const st = await tauriInvoke<{ running: boolean; port: number }>('get_server_status');
      set({ running: st.running, port: st.port, deviceCount: 0 });
    } catch {
      set({ running: false });
    }
  },
}));