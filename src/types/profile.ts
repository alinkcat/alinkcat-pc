export interface UserProfile {
  id: string;
  username: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  themeCount: number;
  downloadCount: number;
  favoriteCount: number;
  favorites: string[];
  apiKey?: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'local-user',
  username: 'Local user',
  avatar: undefined,
  bio: 'ailinkcat user',
  createdAt: new Date().toISOString(),
  themeCount: 0,
  downloadCount: 0,
  favoriteCount: 0,
  favorites: [],
  apiKey: '',
};
