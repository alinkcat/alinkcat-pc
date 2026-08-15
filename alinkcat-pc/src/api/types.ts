// ─── Unified Response ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

// ─── Auth ──────────────────────────────────────────────────

export interface LoginParams {
  username: string; password: string;
  deviceCode?: string; deviceName?: string; deviceType?: string;
  osVersion?: string; appVersion?: string;
}
export interface RegisterParams {
  username: string; password: string;
  email?: string; phone?: string; nickname?: string;
  verificationCode?: string;
}
export interface LoginResult {
  accessToken: string; refreshToken: string; tokenType: string;
  userId: number; username: string; role: string | null;
}
export interface RefreshParams { refreshToken: string }
export interface RegisterStatus {
  needsVerification: boolean;
  whitelistEnabled: boolean;
}
export interface SendCodeParams { username: string; email: string }

// ─── OAuth ─────────────────────────────────────────────────

export interface OAuthLoginResult {
  authorizeUrl: string;
  state: string;
}
export interface OAuthTokenParams { code: string; state: string }
export interface OAuthBindStatus { bound: boolean }

// ─── User ──────────────────────────────────────────────────

export interface UserProfileData {
  id: number; username: string; email: string; phone: string;
  avatar: string; nickname: string; signature: string; address: string;
  country: string; province: string; city: string; profile: string;
  roleId: number; roleName: string; roleCode: string;
  createdAt: string;
  hasMembership: boolean;
  membershipLevel: number;
  membershipName: string;
  membershipEndDate: string;
}
export interface UpdateProfileParams {
  email?: string; phone?: string; avatar?: string; nickname?: string;
  signature?: string; address?: string; country?: string; province?: string;
  city?: string; profile?: string;
}
export interface ChangePasswordParams { oldPassword: string; newPassword: string }

// ─── Theme (market) ────────────────────────────────────────

export interface ThemeItem {
  id: number; themeId: string; userId: number; username: string;
  name: string; version: string; author: string; description: string;
  category: string; tags: string; coverUrl: string; fileUrl: string;
  fileSize: number; fileHash: string; source: number;
  ossUrl: string; ossCoverUrl: string; status: number;
  statusStr: string; statusName: string;
  viewCount: number; downloadCount: number; rating: number; ratingCount: number;
  createdAt: string; updatedAt: string; publishedAt: string;
  reviewComment: string; reviewedAt: string;
}
export interface ThemeListParams {
  page?: number; size?: number; keyword?: string;
  category?: string; status?: number; sortBy?: string; sortOrder?: string;
}

// ─── Category & Tag ────────────────────────────────────────

export interface CategoryItem {
  id: number; name: string; icon: string; sortOrder: number; status: number;
}
export interface TagItem {
  id: number; tagName: string; useCount: number; createdAt: string;
}

// ─── Points ────────────────────────────────────────────────

export interface PointsBalance {
  balance: number; totalEarned: number; totalSpent: number;
  monthlyEarned: number; monthlySpent: number;
  checkedInToday: boolean; checkinStreak: number;
}
export interface PointsRecord {
  id: number; userId: number; amount: number; type: number;
  sourceId: number | null; description: string;
  balance: number; createdAt: string;
}
export interface PointsCheckinResult {
  points: number; total: number; streak: number;
}
export interface PointsExchangeParams { exchangeType: number; targetId?: number | null }
export interface PointsExchangeResult {
  success: boolean; newBalance: number; message: string;
}
export interface PointsRule {
  id: number; actionType: number; basePoints: number;
  dailyLimit: number; multiplier: number; status: number;
}
export interface PointsRankItem {
  userId: number; username: string; totalEarned: number;
}
export interface PointsMallItem {
  id: number; name: string; description: string;
  pointsCost: number; exchangeType: number; stock: number;
  imageUrl: string; status: number; createdAt: string;
}
export interface PointsExchangeRecord {
  id: number; userId: number; exchangeType: number;
  targetId: number | null; pointsCost: number;
  status: number; createdAt: string;
}

// ─── Member ────────────────────────────────────────────────

export interface MemberPlan {
  id: number; name: string; description: string;
  price: number; durationDays: number; level: number;
  benefits: string; status: number; sortOrder: number;
  createdAt: string; updatedAt: string;
}
export interface MemberInfo {
  id: number; userId: number; planId: number; level: number;
  startDate: string; endDate: string; source: number; sourceId: number;
}
export interface OrderCreateParams { planId: number; method: string }
export interface PaymentOrder {
  id: number; orderNo: string; amount: number;
  paymentMethod: string; status: number; paidAt: string;
}
export interface CloudBenefit {
  enabled: boolean; maxTotalBytes: number; maxFileSize: number; maxFiles: number;
}
export interface LevelBenefits {
  cloudStorage: CloudBenefit;
  aiChat: number; noAds: boolean; fastDownload: boolean;
  customTheme: boolean; dataExport: boolean;
  prioritySupport: boolean; multiDevice: boolean;
}
export interface MemberBenefits {
  hasMembership: boolean; level: number; levelName: string;
  endDate: string | null;
  cloudStorage: CloudBenefit & { enabled: boolean };
  benefits: LevelBenefits | null;
}
export interface BenefitsComparison {
  plans: MemberPlan[];
  defaultBenefits: {
    free: LevelBenefits;
    level1: LevelBenefits;
    level2: LevelBenefits;
  };
}

// ─── Ticket ────────────────────────────────────────────────

export interface TicketItem {
  id: number; title: string; content: string;
  category: string; priority: number; status: number;
  images: string; userId: number; username: string;
  createdAt: string; updatedAt: string;
}
export interface TicketCreateParams {
  title: string; content: string;
  category?: string; priority?: number; images?: string;
}
export interface TicketReply {
  id: number; ticketId: number; userId: number;
  content: string; images: string; isStaff: number; createdAt: string;
}

// ─── Invite ────────────────────────────────────────────────

export interface InviteCode {
  id: number; code: string; userId: number;
  useCount: number; maxUse: number; status: number; createdAt: string;
}
export interface InviteRecord {
  id: number; inviteCode: string; inviterId: number;
  inviteeId: number; inviteeUsername: string;
  pointsRewarded: number; createdAt: string;
}

// ─── Device ────────────────────────────────────────────────

export interface UserDevice {
  id: number; userId: number; deviceCode: string;
  deviceName: string; deviceType: string; osVersion: string;
  appVersion: string; ipAddress: string;
  lastLoginAt: string; firstLoginAt: string;
  loginCount: number; status: number;
}

// ─── Notification ──────────────────────────────────────────

export interface NotificationItem {
  id: number; userId: number; type: 'audit' | 'purchase' | 'ticket' | 'points' | 'system';
  title: string; content: string; isRead: number;
  sourceId: number | null; sourceType: string | null;
  createdAt: string;
}

// ─── Cloud ─────────────────────────────────────────────────

export interface CloudFile {
  id: number; userId: number; fileName: string;
  originalName: string;
  fileSize: number; mimeType: string; ossUrl: string;
  category: string; createdAt: string;
}
export interface CloudSpace {
  totalFiles: number; totalBytes: number;
  maxTotalBytes: number; maxFiles: number; maxFileSize: number;
  themeBytes: number; otherBytes: number;
}

// ─── Comment ───────────────────────────────────────────────

export interface ThemeComment {
  id: number; themeId: number; userId: number; username: string;
  avatar: string | null; content: string;
  parentId: number; status: number;
  replyToUsername: string | null;
  createdAt: string;
}

// ─── Version ───────────────────────────────────────────────

export interface ThemeVersion {
  id: number; themeId: string; name: string; version: string;
  description: string; fileSize: number; createdAt: string;
}

// ─── Admin ─────────────────────────────────────────────────

export interface ReviewActionParams {
  themeId: number; action: 'approve' | 'reject'; comment?: string;
}

// ─── Favorite ──────────────────────────────────────────────

export interface FavoriteStatus {
  favorited: boolean;
  favoriteCount: number;
}

// ─── Client Version ────────────────────────────────────────

export interface VersionStatus {
  latestVersion: string;
  latestVersionCode: number;
  needUpdate: boolean;
  status: number;       // 0=正常 1=维护中 2=已废弃
  forceUpdate: number;  // 0=可选 1=强制
  updateUrl: string | null;
  changelog: string | null;
}
export interface Announcement {
  id: number; title: string; content: string;
  targetPlatform: string | null;
  minVersion: string | null; maxVersion: string | null;
  popupType: 'once' | 'every_time';
  status: number; startAt: string | null; endAt: string | null;
  createdAt: string;
}
export interface VersionCheckResult {
  version: VersionStatus;
  announcements: Announcement[];
}
export interface LatestVersion {
  id: number; platform: string; version: string;
  versionCode: number | null; minVersion: string | null;
  status: number; forceUpdate: number;
  updateUrl: string | null; changelog: string | null;
  createdAt: string; updatedAt: string;
}
