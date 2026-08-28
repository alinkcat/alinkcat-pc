/**
 * 通用请求‑映射服务（用于可配置的天气、RSS、JSON 等 widget）
 * - 根据用户在主题 JSON 中填写的 URL、method、headers、body 渲染占位符
 * - 通过 Tauri 的 generic_http 命令执行实际网络请求
 * - 使用 JMESPath（已在项目中通过 npm 安装）把任意返回 JSON 映射为统一的 DTO
 */

import { tauriInvoke } from '../utils/tauri';
// Simple path resolver (dot notation + optional array index) as a lightweight replacement for jmespath
function simpleSearch(obj: any, expr: string): any {
  if (!expr) return undefined;
  const parts = expr.split('.');
  let cur = obj;
  for (const part of parts) {
    const arrMatch = part.match(/^(\w+)\[(\d+)]$/);
    if (arrMatch) {
      const key = arrMatch[1];
      const idx = parseInt(arrMatch[2], 10);
      cur = cur?.[key];
      if (Array.isArray(cur)) cur = cur[idx];
    } else {
      cur = cur?.[part];
    }
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** 简单占位符渲染，例如 "${city}" → 实际值 */
function renderTemplate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\${([^}]+)}/g, (_, key) => {
    const v = vars[key.trim()];
    return v !== undefined ? String(v) : '';
  });
}

/**
 * 发起请求并把返回的 JSON 按映射表转换为目标结构。
 * config.requestUrl、headers、body 均支持占位符。
 * responseMapping 的 value 为 JMESPath 表达式，例如 "main.temp" 或 "weather[0].icon"。
 */
export async function fetchWithMapping(config: {
  requestUrl: string;
  requestMethod: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  vars: Record<string, string | number>;
  responseMapping: Record<string, string>;
}) {
  const { requestUrl, requestMethod, requestHeaders = {}, requestBody = '', vars, responseMapping } = config;

  // 1️⃣ 渲染占位符
  const url = renderTemplate(requestUrl, vars);
  const headers: Record<string, string> = {};
  for (const k of Object.keys(requestHeaders)) {
    headers[k] = renderTemplate(requestHeaders[k], vars);
  }
  const body = requestBody ? renderTemplate(requestBody, vars) : undefined;

  // 2️⃣ 调用后端 generic_http（返回原始 JSON）
  const raw = await tauriInvoke<any>('generic_http', {
    url,
    method: requestMethod,
    headers: Object.keys(headers).length ? headers : undefined,
    body,
  });

  // 3️⃣ 按映射表提取字段
  const result: Record<string, any> = {};
  for (const [target, expr] of Object.entries(responseMapping)) {
    result[target] = simpleSearch(raw, expr);
  }
  return result;
}
