export type PushStatus =
  | 'idle' | 'packing' | 'awaiting_confirm' | 'connecting' | 'pushing'
  | 'completed' | 'failed' | 'cancelled';

export interface PushState {
  themeId: string;
  deviceId: string;
  status: PushStatus;
  progress: number;
  totalSize: number;
  sentSize: number;
  speed: number;
  currentChunk: number;
  totalChunks: number;
  /** 断点续传：下一个要发送的 chunk 索引（失败后记录） */
  resumeChunk: number;
  /** 当前推送阶段：start 等待确认 / chunk 传输 / complete */
  stage?: 'start' | 'chunk' | 'complete';
  /** 是否在等待手机端确认或重试中 */
  waiting?: boolean;
  errorMessage?: string;
}

export const INITIAL_PUSH_STATE: PushState = {
  themeId: '',
  deviceId: '',
  status: 'idle',
  progress: 0,
  totalSize: 0,
  sentSize: 0,
  speed: 0,
  currentChunk: 0,
  totalChunks: 0,
  resumeChunk: 0,
  stage: undefined,
  waiting: false,
  errorMessage: undefined,
};

/** 推送超时与分块配置（与后端常量保持一致） */
export const PUSH_CONFIG = {
  handshakeTimeout: 10000, // awaiting_confirm 等待确认超时
  chunkTimeout: 8000,      // 等待 chunk 确认超时
  maxRetries: 3,           // 最大重试次数
  chunkSize: 64 * 1024,    // 每块 64KB
};

export interface PackedTheme {
  themeId: string;
  name: string;
  version: string;
  size: number;
  hash: string;
  base64: string;
}

export interface PushResult {
  started: boolean;
  themeId: string;
  totalSize: number;
  totalChunks: number;
  hash: string;
}

export interface PushProgressEvent {
  themeId: string;
  progress: number;
  sentSize: number;
  totalSize: number;
  speed: number;
  currentChunk: number;
  totalChunks: number;
}
