import { apiFetch } from './client';
import type { ApiResponse } from './types';

export interface WeatherKeyInfo {
  id?: string;
  /** full key (apply/reset return plaintext shown once; status returns masked) */
  apiKey: string;
  /** legacy field name */
  token?: string;
  /** backend warning message */
  warning?: string | null;
  /** daily request limit, may be absent */
  dailyLimit?: number;
  /** used today, may be absent */
  usedToday?: number;
  status?: 'active' | 'disabled';
  createdAt?: string;
  expiresAt?: string | null;
}

/** pull the full key from response data, handles both apiKey and token fields */
function extractKey(data: WeatherKeyInfo | null | undefined): string {
  return data?.apiKey || data?.token || '';
}

export const weatherApi = {
  /** apply for a weather key (no city binding, plaintext shown once) */
  apply(): Promise<ApiResponse<WeatherKeyInfo>> {
    return apiFetch<ApiResponse<WeatherKeyInfo>>('/api/weather/key/apply', {
      method: 'POST',
    });
  },

  /** current key status (token masked) */
  status(): Promise<ApiResponse<WeatherKeyInfo | null>> {
    return apiFetch<ApiResponse<WeatherKeyInfo | null>>('/api/weather/key/status');
  },

  /** reset key: old one invalidated immediately, returns new plaintext */
  reset(): Promise<ApiResponse<WeatherKeyInfo>> {
    return apiFetch<ApiResponse<WeatherKeyInfo>>('/api/weather/key/reset', {
      method: 'POST',
    });
  },

  /** revoke key */
  revoke(id: string): Promise<ApiResponse<void>> {
    return apiFetch<ApiResponse<void>>(`/api/weather/key/${id}`, { method: 'DELETE' });
  },
};

export { extractKey };