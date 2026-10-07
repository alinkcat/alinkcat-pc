import { create } from 'zustand';
import type { AIMessage, AIConfig, AIInstruction } from '../types/ai';
import { DEFAULT_AI_CONFIG } from '../types/ai';
import { buildSystemPrompt } from '../utils/promptBuilder';
import { buildRequestMessages, streamChat, chatOnce } from '../hooks/useAI';
import { parseInstructions, runInstructions } from '../hooks/useAICommands';
import { useEditorStore } from '../pages/Editor/store/editorStore';

const CONFIG_KEY = 'ilinkcat_ai_config';
const HEIGHT_KEY = 'ai_panel_height';
const MODEL_KEY = 'ai_model';

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_AI_CONFIG;
}

function saveConfig(config: AIConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── session storage ──────────────────────────────────────────────

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function sessionsKey(themeId: string) { return `ai_sessions_${themeId}`; }
function sessionMsgKey(themeId: string, sessionId: string) { return `ai_session_${themeId}_${sessionId}`; }

function loadSessionList(themeId: string): SessionMeta[] {
  try {
    const raw = localStorage.getItem(sessionsKey(themeId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessionList(themeId: string, list: SessionMeta[]) {
  localStorage.setItem(sessionsKey(themeId), JSON.stringify(list.slice(0, 50)));
}

function loadSessionMessages(themeId: string, sessionId: string): AIMessage[] {
  try {
    const raw = localStorage.getItem(sessionMsgKey(themeId, sessionId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessionMessages(themeId: string, sessionId: string, messages: AIMessage[]) {
  localStorage.setItem(sessionMsgKey(themeId, sessionId), JSON.stringify(messages));
}

function deleteSessionMessages(themeId: string, sessionId: string) {
  localStorage.removeItem(sessionMsgKey(themeId, sessionId));
}

// ─── Store ─────────────────────────────────────────────────

export interface DroppedImage {
  name: string;      // image 1、image 2...
  fileName: string;  // original filename
  dataUrl: string;   // base64 data URL
}

interface AIState {
  messages: AIMessage[];
  config: AIConfig;
  model: string;
  panelHeight: number;
  panelCollapsed: boolean;
  historyOpen: boolean;
  settingsOpen: boolean;
  sending: boolean;
  themeId: string;
  currentSessionId: string | null;
  sessions: SessionMeta[];
  droppedImages: DroppedImage[];
  snapshots: string[];

  initTheme: (themeId: string) => void;
  setModel: (m: string) => void;
  updateConfig: (partial: Partial<AIConfig>) => void;
  setPanelHeight: (h: number) => void;
  togglePanel: () => void;
  toggleHistory: () => void;
  toggleSettings: () => void;
  newSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearHistory: () => void;
  sendMessage: (content: string) => Promise<void>;
  confirmInstruction: (messageId: string, instrId: string) => void;
  cancelInstruction: (messageId: string, instrId: string) => void;
  pushSnapshot: (json: string) => void;
  restoreLastSnapshot: () => boolean;
  addDroppedImages: (files: { name: string; dataUrl: string }[]) => void;
  removeDroppedImage: (name: string) => void;
  clearDroppedImages: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  config: loadConfig(),
  model: localStorage.getItem(MODEL_KEY) || loadConfig().defaultModel,
  panelHeight: Number(localStorage.getItem(HEIGHT_KEY) || 300),
  panelCollapsed: true,
  historyOpen: false,
  settingsOpen: false,
  sending: false,
  themeId: '',
  currentSessionId: null,
  sessions: [],
  droppedImages: [],
  snapshots: [],

  // ─── initialize theme ──────────────────────────────────────
  initTheme: (themeId) => {
    const s = get();
    if (s.themeId === themeId && s.messages.length > 0) return;
    // save the current theme session
    if (s.themeId && s.currentSessionId && s.messages.length > 0) {
      saveSessionMessages(s.themeId, s.currentSessionId, s.messages);
    }
    // load the new theme session list
    const sessions = loadSessionList(themeId);
    let currentSessionId: string | null = null;
    let messages: AIMessage[] = [];
    if (sessions.length > 0) {
      // restore the most recent session
      currentSessionId = sessions[0].id;
      messages = loadSessionMessages(themeId, currentSessionId);
    } else {
      // create a new session
      currentSessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const meta: SessionMeta = {
        id: currentSessionId, title: 'New chat',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messageCount: 0,
      };
      sessions.unshift(meta);
      saveSessionList(themeId, sessions);
    }
    set({ themeId, messages, currentSessionId, sessions });
  },

  // ─── new session ──────────────────────────────────────
  newSession: () => {
    const s = get();
    if (!s.themeId) return;
    // save current session
    if (s.currentSessionId && s.messages.length > 0) {
      saveSessionMessages(s.themeId, s.currentSessionId, s.messages);
      const list = loadSessionList(s.themeId);
      const idx = list.findIndex((m) => m.id === s.currentSessionId);
      if (idx >= 0) {
        list[idx].updatedAt = new Date().toISOString();
        list[idx].messageCount = s.messages.length;
        saveSessionList(s.themeId, list);
      }
    }
    // create a new session
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const meta: SessionMeta = {
      id, title: 'New chat',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      messageCount: 0,
    };
    const sessions = loadSessionList(s.themeId);
    sessions.unshift(meta);
    saveSessionList(s.themeId, sessions);
    set({ currentSessionId: id, messages: [], sessions });
  },

  // ─── load a specific session ──────────────────────────────────
  loadSession: (sessionId) => {
    const s = get();
    if (!s.themeId) return;
    // save current session
    if (s.currentSessionId && s.messages.length > 0) {
      saveSessionMessages(s.themeId, s.currentSessionId, s.messages);
      const list = loadSessionList(s.themeId);
      const idx = list.findIndex((m) => m.id === s.currentSessionId);
      if (idx >= 0) {
        list[idx].updatedAt = new Date().toISOString();
        list[idx].messageCount = s.messages.length;
        saveSessionList(s.themeId, list);
      }
    }
    // load the target session
    const messages = loadSessionMessages(s.themeId, sessionId);
    set({ currentSessionId: sessionId, messages });
  },

  // ─── delete session ──────────────────────────────────────
  deleteSession: (sessionId) => {
    const s = get();
    if (!s.themeId) return;
    const list = loadSessionList(s.themeId).filter((m) => m.id !== sessionId);
    saveSessionList(s.themeId, list);
    deleteSessionMessages(s.themeId, sessionId);
    set({ sessions: list });
    if (s.currentSessionId === sessionId) {
      // current session was deleted，switch to the most recent one
      if (list.length > 0) {
        const next = list[0];
        const messages = loadSessionMessages(s.themeId, next.id);
        set({ currentSessionId: next.id, messages });
      } else {
        // no session，create a new session
        get().newSession();
      }
    }
  },

  // ─── clear current session ──────────────────────────────────
  clearHistory: () => {
    const s = get();
    if (!s.themeId || !s.currentSessionId) return;
    saveSessionMessages(s.themeId, s.currentSessionId, []);
    const list = loadSessionList(s.themeId);
    const idx = list.findIndex((m) => m.id === s.currentSessionId);
    if (idx >= 0) {
      list[idx].messageCount = 0;
      list[idx].updatedAt = new Date().toISOString();
      saveSessionList(s.themeId, list);
      set({ sessions: list });
    }
    set({ messages: [] });
  },

  setModel: (m) => {
    localStorage.setItem(MODEL_KEY, m);
    set({ model: m });
  },

  updateConfig: (partial) => {
    const config = { ...get().config, ...partial };
    saveConfig(config);
    set({ config });
  },

  setPanelHeight: (h) => {
    localStorage.setItem(HEIGHT_KEY, String(h));
    set({ panelHeight: h });
  },

  togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

  pushSnapshot: (json) => set((s) => ({ snapshots: [...s.snapshots, json].slice(-20) })),

  restoreLastSnapshot: () => {
    const s = get();
    if (s.snapshots.length === 0) return false;
    const last = s.snapshots[s.snapshots.length - 1];
    try {
      const theme = JSON.parse(last);
      useEditorStore.getState().replaceTheme(theme);
      set({ snapshots: s.snapshots.slice(0, -1) });
      return true;
    } catch { return false; }
  },

  // ─── send message ──────────────────────────────────────
  sendMessage: async (content) => {
    const { config, model, themeId, currentSessionId } = get();
    if (!config.apiKey) {
      set((s) => ({
        messages: [...s.messages, {
          id: genId(), role: 'assistant', content: 'please configure the AI API key in system settings before use',
          timestamp: Date.now(), status: 'error',
        }],
      }));
      return;
    }
    if (get().sending) return;

    const userMsg: AIMessage = { id: genId(), role: 'user', content, timestamp: Date.now(), status: 'done' };
    const aiMsg: AIMessage = {
      id: genId(), role: 'assistant', content: '', timestamp: Date.now(),
      status: config.streamOutput ? 'streaming' : 'sending',
    };

    // note: build the request from history BEFORE set() adds this round's messages——
    // otherwise get().messages already contains this round's userMsg（content sent twice）
    // and the empty aiMsg placeholder (sending an empty assistant message to the model).
    const editorState = useEditorStore.getState();
    const system = buildSystemPrompt(editorState.theme, editorState.activePageIdx, get().droppedImages);
    const reqMsgs = buildRequestMessages(system, get().messages.filter((m) => m.role !== 'system'), content, config.maxTurns);

    set((s) => ({ sending: true, messages: [...s.messages, userMsg, aiMsg] }));

    try {
      let full = '';
      if (config.streamOutput) {
        for await (const chunk of streamChat(reqMsgs, config, model)) {
          full += chunk;
          set((s) => ({
            messages: s.messages.map((m) => (m.id === aiMsg.id ? { ...m, content: full } : m)),
          }));
        }
      } else {
        full = await chatOnce(reqMsgs, config, model);
      }

      const instrs = parseInstructions(full);
      let finalMsg: AIMessage = { ...aiMsg, content: full, status: 'done', instructions: instrs };

      // autoExecute only auto-runs normal instructions；danger（full-page generation and other destructive ops）forces waiting for user confirmation
      const auto = instrs.filter((i) => i.severity !== 'danger');
      if (auto.length > 0 && config.autoExecute) {
        const r = runInstructions(auto);
        auto.forEach((i) => { i.confirmed = true; });
        finalMsg = { ...finalMsg, instructions: instrs };
        // on silent auto-execute failure，surface the error to the user（avoid"no feedback on click"）
        if (r.errors.length > 0) {
          const failLine = r.errors.map((e) => `⚠️ ${e}`).join('\n');
          finalMsg = { ...finalMsg, content: `${full}\n\n${failLine}` };
        }
      }

      set((s) => ({
        sending: false,
        messages: s.messages.map((m) => (m.id === aiMsg.id ? finalMsg : m)),
      }));

      // save to the current session。must verify the session identity is unchanged：if the user switched session/theme mid-stream，
      // the old theme save must not overwrite the new session/theme messages。
      if (themeId && currentSessionId && get().themeId === themeId && get().currentSessionId === currentSessionId) {
        const msgs = get().messages;
        saveSessionMessages(themeId, currentSessionId, msgs);
        // update session metadata
        const list = loadSessionList(themeId);
        const idx = list.findIndex((m) => m.id === currentSessionId);
        if (idx >= 0) {
          list[idx].messageCount = msgs.length;
          list[idx].updatedAt = new Date().toISOString();
          if (list[idx].title === 'New chat' && msgs.length > 0) {
            const first = msgs.find((m) => m.role === 'user');
            if (first) list[idx].title = first.content.slice(0, 40);
          }
          saveSessionList(themeId, list);
          set({ sessions: list });
        }
      }
    } catch (e) {
      set((s) => ({
        sending: false,
        messages: s.messages.map((m) =>
          m.id === aiMsg.id ? { ...m, content: String((e as Error).message || e), status: 'error' } : m
        ),
      }));
    }
  },

  confirmInstruction: (messageId, instrId) => {
    const s = get();
    const message = s.messages.find((m) => m.id === messageId);
    if (!message?.instructions) return;
    const instr = message.instructions.find((i) => i.id === instrId);
    if (!instr) return;
    // runInstructions writes back executed/failed/error（execute on a copy，avoid mutating store state in place）
    const copy: AIInstruction = { ...instr };
    runInstructions([copy]);
    copy.confirmed = true;
    copy.executed = true;
    const instructions = message.instructions;
    set({ messages: s.messages.map((m) => (m.id === messageId
      ? { ...m, instructions: instructions.map((i) => (i.id === instrId ? copy : i)) }
      : m)) });
  },

  cancelInstruction: (messageId, instrId) => {
    const s = get();
    const message = s.messages.find((m) => m.id === messageId);
    if (!message?.instructions) return;
    const instructions = message.instructions;
    set({ messages: s.messages.map((m) => (m.id === messageId
      ? { ...m, instructions: instructions.map((i) => (i.id === instrId ? { ...i, canceled: true, confirmed: false } : i)) }
      : m)) });
  },

  addDroppedImages: (files) => {
    const s = get();
    const existing = s.droppedImages.map((d) => d.name);
    const next = s.droppedImages.slice();
    for (const f of files) {
      if (!existing.includes(f.name)) next.push({ name: f.name, fileName: f.name, dataUrl: f.dataUrl });
    }
    set({ droppedImages: next });
  },

  removeDroppedImage: (name) => {
    set((s) => ({ droppedImages: s.droppedImages.filter((d) => d.name !== name) }));
  },

  clearDroppedImages: () => set({ droppedImages: [] }),
}));