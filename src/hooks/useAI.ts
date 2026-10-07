import type { AIConfig, AIMessage } from '../types/ai';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri, tauriInvoke } from '../utils/tauri';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** build request messages（system prompt + truncated history + current input） */
export function buildRequestMessages(
  system: string,
  history: AIMessage[],
  userContent: string,
  maxTurns: number,
): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: system }];

  // take the last maxTurns turns（user+assistant pairs）。guard against invalid values：null/NaN/<=0 fall back to 20 turns
  // （slice(-0) semantics is"take all"not"no truncation"，an empty maxTurns would send the full history，token cost explodes）。
  const turns = Number.isFinite(maxTurns) && maxTurns > 0 ? maxTurns : 20;
  const recent = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-turns * 2);

  for (const m of recent) {
    msgs.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }
  msgs.push({ role: 'user', content: userContent });
  return msgs;
}

/**
 * call an OpenAI-compatible endpoint（streaming）。
 * - Tauri env：via the Rust ai_chat_stream command（bypass CORS），
 *   via Tauri events ai-chunk / ai-done / ai-error receive increments chunk by chunk。
 * - browser env (dev)：falls back to native fetch SSE streaming。
 * returns an AsyncGenerator，yielding incremental text。
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  if (!config.apiUrl) throw new Error('please configure the AI service URL in settings first');
  if (!model) throw new Error('please select an AI model in settings first');
  const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  const body = JSON.stringify({ model, messages, stream: true, temperature: 0.7 });

  // ─── Tauri env: Rust streaming command + event push ──────────────────
  if (isTauri()) {
    const queue: string[] = [];
    let settled = false;
    let failMsg: string | null = null;
    let wake: (() => void) | null = null;

    const push = (s: string) => {
      queue.push(s);
      wake?.();
    };
    const onDone = () => {
      settled = true;
      wake?.();
    };
    const onError = (msg: string) => {
      failMsg = msg;
      settled = true;
      wake?.();
    };

    const unlisteners: UnlistenFn[] = [];
    unlisteners.push(await listen<string>('ai-chunk', (e) => push(e.payload)));
    unlisteners.push(await listen('ai-done', onDone));
    unlisteners.push(await listen<string>('ai-error', (e) => onError(e.payload)));

    try {
      // fire the request in the background，data carried by events（do not await its completion）
      const invokePromise = tauriInvoke('ai_chat_stream', { url, headers, body }).catch(
        (e) => onError(String(e instanceof Error ? e.message : e)),
      );

      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        if (settled) break;
        await new Promise<void>((r) => {
          wake = r;
        });
        wake = null;
      }
      await invokePromise; // ensure the command completes，swallow already-handled errors
      if (failMsg) throw new Error(failMsg);
      return;
    } finally {
      unlisteners.forEach((u) => u());
    }
  }

  // ─── browser env: native fetch SSE streaming (dev) ──────────────
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal,
  });

  if (res.status === 401) {
    throw new Error('API key invalid, please configure in settings');
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(`AI service unavailable (${res.status}) ${bodyText.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('cannot read response stream');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) yield delta;
        } catch {
          // ignore unparseable data lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** non-streaming call（fallback when the model does not support streaming） */
export async function chatOnce(
  messages: ChatMessage[],
  config: AIConfig,
  model: string,
): Promise<string> {
  if (!config.apiUrl) throw new Error('please configure the AI service URL in settings first');
  if (!model) throw new Error('please select an AI model in settings first');
  const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`;

  // Tauri env: via Rust api_request (bypass CORS)
  if (isTauri()) {
    const result = await tauriInvoke<{ status: number; body: unknown }>('api_request', {
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: { model, messages, stream: false, temperature: 0.7 },
    });
    if (result.status === 401) throw new Error('API key invalid, please configure in settings');
    if (result.status >= 400) throw new Error(`AI service unavailable (${result.status})`);
    const json = result.body as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? '';
  }

  // browser env：native fetch
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false, temperature: 0.7 }),
  });
  if (res.status === 401) throw new Error('API key invalid, please configure in settings');
  if (!res.ok) throw new Error(`AI service unavailable (${res.status})`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}