import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriInvoke } from '../utils/tauri';
import { sendPushCancel } from './useWebSocket';
import type { PushState, PushProgressEvent, PushResult } from '../types/push';
import { INITIAL_PUSH_STATE } from '../types/push';

type StartOpts = {
  themeId: string;
  deviceId: string;
  startChunk?: number;
};

/**
 * 主题包推送 Hook：
 * - push_theme_to_device（后端分块推送 + awaiting_confirm + busy/超时重试）
 * - 监听 Tauri 事件 theme-push-progress / theme-push-complete / theme-push-failed
 * - 失败后支持「继续」（断点续传）与「重传」
 */
export function useThemePush() {
  const [state, setState] = useState<PushState>(INITIAL_PUSH_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const unlisteners = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setup = async () => {
      const un1 = await listen<PushProgressEvent>('theme-push-progress', (e) => {
        setState((s) => ({
          ...s,
          status: s.status === 'completed' || s.status === 'failed' ? s.status : 'pushing',
          stage: e.payload.currentChunk === 0 && e.payload.progress <= 0 ? 'start' : 'chunk',
          waiting: false,
          progress: e.payload.progress,
          sentSize: e.payload.sentSize,
          totalSize: e.payload.totalSize,
          speed: e.payload.speed,
          currentChunk: e.payload.currentChunk,
          totalChunks: e.payload.totalChunks,
        }));
      });
      const un2 = await listen<{ themeId: string; status: string }>('theme-push-complete', () => {
        setState((s) => ({ ...s, status: 'completed', progress: 100, waiting: false, stage: 'complete' }));
      });
      const un3 = await listen<{ themeId: string; error: string }>('theme-push-failed', (e) => {
        setState((s) => {
          // 已传输部分数据 → 可从下一块续传；否则从头开始
          const resumeChunk = s.sentSize > 0 ? s.currentChunk + 1 : 0;
          return { ...s, status: 'failed', waiting: false, resumeChunk, errorMessage: e.payload.error };
        });
      });
      unlisteners.current = [un1, un2, un3];
    };
    setup();
    return () => {
      unlisteners.current.forEach((fn) => fn());
      unlisteners.current = [];
    };
  }, []);

  const invokePush = useCallback(async ({ themeId, deviceId, startChunk = 0 }: StartOpts) => {
    setState((s) => ({
      ...s,
      themeId,
      deviceId,
      resumeChunk: startChunk,
      status: startChunk > 0 ? 'pushing' : 'awaiting_confirm',
      stage: 'start',
      progress: 0,
      sentSize: 0,
      speed: 0,
      errorMessage: undefined,
    }));
    try {
      const result = await tauriInvoke<PushResult>('push_theme_to_device', {
        themeId,
        clientId: deviceId,
        startChunk,
      });
      setState((s) => ({
        ...s,
        status: startChunk > 0 ? 'pushing' : 'awaiting_confirm',
        stage: 'start',
        totalSize: result.totalSize,
        totalChunks: result.totalChunks,
      }));
    } catch (e) {
      setState((s) => ({ ...s, status: 'failed', errorMessage: String(e) }));
    }
  }, []);

  const startPush = useCallback((themeId: string, deviceId: string) => {
    invokePush({ themeId, deviceId, startChunk: 0 });
  }, [invokePush]);

  /** 断点续传：从上次中断的 chunk 继续 */
  const resumePush = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.themeId || !cur.deviceId || cur.resumeChunk <= 0) return;
    invokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: cur.resumeChunk });
  }, [invokePush]);

  /** 重传：从头开始 */
  const retryPush = useCallback(() => {
    const cur = stateRef.current;
    if (!cur.themeId || !cur.deviceId) return;
    invokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0 });
  }, [invokePush]);

  const cancelPush = useCallback(async () => {
    const cur = stateRef.current;
    if (cur.deviceId && cur.themeId) {
      try {
        await sendPushCancel(cur.themeId, cur.deviceId);
      } catch { /* ignore */ }
    }
    setState((s) => ({ ...s, status: 'cancelled' }));
  }, []);

  const reset = useCallback(() => setState(INITIAL_PUSH_STATE), []);

  return { state, startPush, resumePush, retryPush, cancelPush, reset };
}
