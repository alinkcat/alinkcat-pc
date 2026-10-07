export type PushStatus =
  | 'idle' | 'packing' | 'awaiting_confirm' | 'connecting' | 'pushing'
  | 'completed' | 'failed' | 'cancelled' | 'retrying';

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
  /** next chunk index to send, recorded on failure for resuming */
  resumeChunk: number;
  /** push stage: start awaiting confirm / chunk transfer / complete */
  stage?: 'start' | 'chunk' | 'complete';
  /** waiting for phone-side confirm or retry */
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

/** push timeouts and chunking, must stay in sync with backend constants */
export const PUSH_CONFIG = {
  handshakeTimeout: 10000, // awaiting_confirm timeout
  chunkTimeout: 8000,      // per-chunk ack timeout
  maxRetries: 3,           // retries
  chunkSize: 64 * 1024,    // 64KB per chunk
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
