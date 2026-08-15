import { apiFetch } from './client';
import type { ApiResponse, VersionCheckResult, LatestVersion } from './types';

function qs(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export const clientVersionApi = {
  check: (platform: string, version: string) =>
    apiFetch<ApiResponse<VersionCheckResult>>(`/api/client/version/check${qs({ platform, version })}`),
  latest: (platform: string) =>
    apiFetch<ApiResponse<LatestVersion>>(`/api/client/version/latest${qs({ platform })}`),
};