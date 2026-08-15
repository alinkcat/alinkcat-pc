import type { AIConfig, AIMessage } from '../types/ai';

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

  // 取最近 maxTurns 轮（用户+助手成对）
  const recent = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-maxTurns * 2);

  for (const m of recent) {
    msgs.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }
  msgs.push({ role: 'user', content: userContent });
  return msgs;
}

/**
 * 调用 OpenAI 兼容接口（流式）。
 * 返回 AsyncGenerator，逐段产出增量文本。
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: AIConfig,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const url = `${config.apiUrl.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
    }),
    signal,
  });

  if (res.status === 401) {
    throw new Error('API Key 无效，请在设置中配置');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI 服务不可用 (${res.status}) ${body.slice(0, 200)}`);
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
