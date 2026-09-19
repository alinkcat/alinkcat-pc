import { tauriInvoke } from '../utils/tauri';

// lightweight JSON getter：dot path + optional array index，replaces jmespath
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

/** simple placeholder rendering，e.g. "${city}" → actual value */
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

  // render placeholders first，then call the backend generic_http
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

  // extract fields per the mapping table
  const result: Record<string, any> = {};
  for (const [target, expr] of Object.entries(responseMapping)) {
    result[target] = simpleSearch(raw, expr);
  }
  return result;
}
