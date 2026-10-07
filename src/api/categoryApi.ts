import { apiFetch } from './client';
import type { ApiResponse, CategoryItem, TagItem } from './types';

export const categoryApi = {
  list: () => apiFetch<ApiResponse<CategoryItem[]>>('/api/category/list'),
  hotTags: () => apiFetch<ApiResponse<TagItem[]>>('/api/tag/hot'),
};
