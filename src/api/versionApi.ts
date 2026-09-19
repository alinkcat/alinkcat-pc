import { apiFetch } from './client';
import type { ApiResponse, ThemeVersion } from './types';

export const versionApi = {
  list: (themeId: string) =>
    apiFetch<ApiResponse<ThemeVersion[]>>(`/api/theme/${themeId}/versions`),
};