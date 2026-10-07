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
  /** full theme for a full-page generation instruction JSON */
  theme?: Record<string, unknown>;
  executed: boolean;
  confirmed: boolean;
  canceled?: boolean;
  /** execution failure flag（runInstructions set when runInstructions reports failure） */
  failed?: boolean;
  /** failure reason（human-readable） */
  error?: string;
  /** destructive instruction（e.g. generate_full_theme）forces confirmation even with autoExecute */
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

// default AI config left empty：no vendor pre-filled（DeepSeek/OpenAI etc.），user fills in their own
export const DEFAULT_AI_CONFIG: AIConfig = {
  apiUrl: '',
  apiKey: '',
  models: [],
  defaultModel: '',
  autoExecute: false,
  streamOutput: true,
  maxTurns: 20,
};
