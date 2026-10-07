import { tauriInvoke } from '../../../../utils/tauri';

export interface LunarInfo {
  solar: string;
  lunarYear: string;
  lunarMonth: string;
  lunarDay: string;
  lunar: string;
  isLeap: boolean;
}

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export const WEEKDAY_ABBR = ['日', '一', '二', '三', '四', '五', '六'];

/** format a date from a template, tokens: YYYY / MM / DD / 星期X / 星期; pass translated weekday names via weekdays */
export function fmtDate(d: Date, fmt: string, weekdays: string[] = WEEKDAYS): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const wd = weekdays[d.getDay()] ?? weekdays[0];
  return fmt
    .replace('YYYY', String(y))
    .replace('MM', m)
    .replace('DD', dd)
    .replace('星期X', wd)
    .replace('星期', wd);
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** lunar calendar info from the Rust backend; null outside Tauri or on error */
export async function fetchLunar(date: Date): Promise<LunarInfo | null> {
  try {
    return await tauriInvoke<LunarInfo>('get_lunar_info', { date: toDateStr(date) });
  } catch {
    return null;
  }
}