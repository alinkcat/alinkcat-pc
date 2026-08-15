import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type { InvokeArgs } from '@tauri-apps/api/core';

function isTauri(): boolean {
  try {
    return '__TAURI_INTERNALS__' in window;
  } catch {
    return false;
  }
}

export async function tauriInvoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  if (!isTauri()) {
    throw new Error('Tauri IPC not available');
  }
  return invoke<T>(cmd, args);
}

export function tauriConvertFileSrc(path: string): string {
  if (!isTauri()) {
    return '';
  }
  return convertFileSrc(path);
}
