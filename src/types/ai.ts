export interface AIInstruction {
  id: string;
  type: 'add_widget' | 'delete_widget' | 'update_widget' | 'duplicate_widget'
    | 'move_widget' | 'resize_widget'
    | 'add_page' | 'delete_page' | 'reorder_pages'
    | 'change_layout' | 'set_background'
    | 'set_orientation' | 'set_theme_meta'
    | 'batch'
    | 'generate_full_theme';
  pageIndex?: number;
  widget?: Record<string, unknown>;
  params?: Record<string, unknown>;
  /** 整页生成指令的完整主题 JSON */
  theme?: Record<string, unknown>;
  executed: boolean;
  confirmed: boolean;
  canceled?: boolean;
  /** 执行失败标记（runInstructions 返回失败时置位） */
  failed?: boolean;
  /** 失败原因（人类可读） */
  error?: string;
  /** 破坏性指令（如 generate_full_theme）即使 autoExecute 也强制确认 */
  severity?: 'normal' | 'danger';
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  instructions?: AIInstruction[];
  status?: 'sending' | 'streaming' | 'done' | 'error';
}

export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  autoExecute: boolean;
  streamOutput: boolean;
  maxTurns: number;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  apiUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  models: ['deepseek-chat', 'deepseek-coder', 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'],
  defaultModel: 'deepseek-chat',
  autoExecute: false,
  streamOutput: true,
  maxTurns: 20,
};
