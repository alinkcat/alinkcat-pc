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
  username: '本地用户',
  avatar: undefined,
  bio: '艾联猫 · iLinkCat 用户',
  createdAt: new Date().toISOString(),
  themeCount: 0,
  downloadCount: 0,
  favoriteCount: 0,
  favorites: [],
  apiKey: '',
};
