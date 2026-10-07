import { apiFetch } from './client';
import type { ApiResponse } from './types';

export interface WeatherKeyInfo {
  id?: string;
  /** full key text（apply/reset returns plaintext, shown only once；status returns masked） */
  apiKey: string;
  /** compat: legacy field name token */
  token?: string;
  /** backend prompt text（e.g."The key is shown only once. Save it now."） */
  warning?: string | null;
  /** daily request limit (backend may omit) */
  dailyLimit?: number;
  /** used today (backend may omit) */
  usedToday?: number;
  status?: 'active' | 'disabled';
  createdAt?: string;
  expiresAt?: string | null;
}

/** extract the full key from response data（compat with apiKey / token field names） */
function extractKey(data: WeatherKeyInfo | null | undefined): string {
  return data?.apiKey || data?.token || '';
}

export const weatherApi = {
  /** apply for a weather key (no city binding, shown once) */
  apply(): Promise<ApiResponse<WeatherKeyInfo>> {
    return apiFetch<ApiResponse<WeatherKeyInfo>>('/api/weather/key/apply', {
      method: 'POST',
    });
  },

  /** query the current weather key status（token is masked，show only the mask） */
  status(): Promise<ApiResponse<WeatherKeyInfo | null>> {
    return apiFetch<ApiResponse<WeatherKeyInfo | null>>('/api/weather/key/status');
  },

  /** reset key: old key invalidated immediately, returns new plaintext */
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