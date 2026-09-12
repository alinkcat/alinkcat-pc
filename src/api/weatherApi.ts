import { apiFetch } from './client';
import type { ApiResponse } from './types';

export interface WeatherKeyInfo {
  id?: string;
  /** 密钥全文（apply/reset 返回明文仅展示一次；status 返回掩码） */
  apiKey: string;
  /** 兼容旧字段名 token */
  token?: string;
  /** 后端提示文案（如"密钥仅在此展示一次，请立即复制保存"） */
  warning?: string | null;
  /** 每日请求上限（后端可能不返回） */
  dailyLimit?: number;
  /** 今日已用（后端可能不返回） */
  usedToday?: number;
  status?: 'active' | 'disabled';
  createdAt?: string;
  expiresAt?: string | null;
}

/** 从响应 data 中提取密钥全文（兼容 apiKey / token 字段名） */
function extractKey(data: WeatherKeyInfo | null | undefined): string {
  return data?.apiKey || data?.token || '';
}

export const weatherApi = {
  /** 申请天气 Key（无城市绑定，仅展示一次） */
  apply(): Promise<ApiResponse<WeatherKeyInfo>> {
    return apiFetch<ApiResponse<WeatherKeyInfo>>('/api/weather/key/apply', {
      method: 'POST',
    });
  },

  /** 查询当前天气 Key 状态（token 被遮蔽，仅展示掩码） */
  status(): Promise<ApiResponse<WeatherKeyInfo | null>> {
    return apiFetch<ApiResponse<WeatherKeyInfo | null>>('/api/weather/key/status');
  },

  /** 重置 Key：旧 Key 立即作废，返回新明文 */
  reset(): Promise<ApiResponse<WeatherKeyInfo>> {
    return apiFetch<ApiResponse<WeatherKeyInfo>>('/api/weather/key/reset', {
      method: 'POST',
    });
  },

  /** 吊销 Key */
  revoke(id: string): Promise<ApiResponse<void>> {
    return apiFetch<ApiResponse<void>>(`/api/weather/key/${id}`, { method: 'DELETE' });
  },
};

export { extractKey };