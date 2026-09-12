import type { AIConfig, AIMessage } from '../types/ai';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri, tauriInvoke } from '../utils/tauri';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 构造请求消息（系统 Prompt + 截断的历史 + 当前输入） */
export function buildRequestMessages(
  system: string,
  history: AIMessage[],
  userContent: string,
  maxTurns: number,
): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: system }];

  // 取最近 maxTurns 轮（用户+助手成对）。防御非法值：null/NaN/<=0 时回退 20 轮
  // （slice(-0) 语义是"取全部"而非"不截断"，若 maxTurns 为空会意外发送全量历史，token 成本爆炸）。
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
 * 调用 OpenAI 兼容接口（流式）。
 * - Tauri 环境：走 Rust 后端 ai_chat_stream 命令（绕过 CORS），
 *   通过 Tauri 事件 ai-chunk / ai-done / ai-error 逐段接收增量。
 * - 浏览器环境（开发）：回退到原生 fetch 的 SSE 流式。
 * 返回 AsyncGenerator，逐段产出增量文本。
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
  const body = JSON.stringify({ model, messages, stream: true, temperature: 0.7 });

  // ─── Tauri 环境：Rust 流式命令 + 事件推送 ──────────────────
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
      // 后台发起请求，数据由事件携带（不 await 其完成）
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
      await invokePromise; // 确保命令完成，吞掉已处理的错误
      if (failMsg) throw new Error(failMsg);
      return;
    } finally {
      unlisteners.forEach((u) => u());
    }
  }

  // ─── 浏览器环境：原生 fetch SSE 流式（开发用） ──────────────
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal,
  });

  if (res.status === 401) {
    throw new Error('API Key 无效，请在设置中配置');
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(`AI 服务不可用 (${res.status}) ${bodyText.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

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
          // 忽略解析失败的数据行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** 非流式调用（模型不支持流式时降级） */
export async function chatOnce(
  messages: ChatMessage[],
  config: AIConfig,
  model: string,
): Promise<string> {
  const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`;

  // Tauri 环境：走 Rust api_request（绕过 CORS）
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
    if (result.status === 401) throw new Error('API Key 无效，请在设置中配置');
    if (result.status >= 400) throw new Error(`AI 服务不可用 (${result.status})`);
    const json = result.body as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? '';
  }

  // 浏览器环境：原生 fetch
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false, temperature: 0.7 }),
  });
  if (res.status === 401) throw new Error('API Key 无效，请在设置中配置');
  if (!res.ok) throw new Error(`AI 服务不可用 (${res.status})`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}