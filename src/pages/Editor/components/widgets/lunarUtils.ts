import { tauriInvoke } from '../../../../utils/tauri';

export interface LunarInfo {
  solar: string;
  lunarYear: string;
  lunarMonth: string;
  lunarDay: string;
  lunar: string;
  isLeap: boolean;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** format date by template，supports YYYY / MM / DD / weekday tokens；weekdays can be a translated array of weekday names。 */
export function fmtDate(d: Date, fmt: string, weekdays: string[] = WEEKDAYS): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const wd = weekdays[d.getDay()] ?? weekdays[0];
  return fmt
    .replace('YYYY', String(y))
    .replace('MM', m)
    .replace('DD', dd)
    .replace('WWW', wd)
    .replace('WD', wd);
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** get lunar info via the Rust backend；returns null outside Tauri or on error。 */
export async function fetchLunar(date: Date): Promise<LunarInfo | null> {
  try {
    return await tauriInvoke<LunarInfo>('get_lunar_info', { date: toDateStr(date) });
  } catch {
    return null;
  }
}