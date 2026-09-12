import { tauriInvoke } from '../utils/tauri';

// 轻量 JSON 取值：点号路径 + 可选数组下标，替代 jmespath
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

export async function fetchWithMapping(config: {
  requestUrl: string;
  requestMethod: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  vars: Record<string, string | number>;
  responseMapping: Record<string, string>;
}) {
  const { requestUrl, requestMethod, requestHeaders = {}, requestBody = '', vars, responseMapping } = config;

  // 先渲染占位符，再走后端 generic_http
  const url = renderTemplate(requestUrl, vars);
  const headers: Record<string, string> = {};
  for (const k of Object.keys(requestHeaders)) {
    headers[k] = renderTemplate(requestHeaders[k], vars);
  }
  const body = requestBody ? renderTemplate(requestBody, vars) : undefined;

  const raw = await tauriInvoke<any>('generic_http', {
    url,
    method: requestMethod,
    headers: Object.keys(headers).length ? headers : undefined,
    body,
  });

  // 按映射表提取字段
  const result: Record<string, any> = {};
  for (const [target, expr] of Object.entries(responseMapping)) {
    result[target] = simpleSearch(raw, expr);
  }
  return result;
}
