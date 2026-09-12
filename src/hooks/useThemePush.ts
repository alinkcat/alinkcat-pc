import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriInvoke } from '../utils/tauri';
import { sendPushCancel } from './useWebSocket';
import type { PushState, PushProgressEvent, PushResult } from '../types/push';
import { INITIAL_PUSH_STATE } from '../types/push';

type StartOpts = {
  themeId: string;
  deviceId: string; // 单设备内部使用
  startChunk?: number;
};

const AUTO_RETRY_DELAY = 3000; // 3 秒后自动重试
const MAX_AUTO_RETRIES = 2;    // 最多重试 2 次

/**
 * 主题包推送 Hook：
 * - push_theme_to_device（后端分块推送 + awaiting_confirm + busy/超时重试）
 * - 监听 Tauri 事件 theme-push-progress / theme-push-complete / theme-push-failed
 * - 失败后支持「继续」（断点续传）与「重传」
 * - 自动重试：失败后等待 3 秒自动重试，最多 2 次，用户可取消
 */
export function useThemePush() {
  const [state, setState] = useState<PushState & { autoRetryCount: number }>({ ...INITIAL_PUSH_STATE, autoRetryCount: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const unlisteners = useRef<UnlistenFn[]>([]);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理自动重试定时器
  const clearAutoRetry = useCallback(() => {
    if (autoRetryTimer.current !== null) {
      clearTimeout(autoRetryTimer.current);
      autoRetryTimer.current = null;
    }
  }, []);

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
        clearAutoRetry();
        setState((s) => ({ ...s, status: 'completed', progress: 100, waiting: false, stage: 'complete' }));
      });
      const un3 = await listen<{ themeId: string; error: string }>('theme-push-failed', (e) => {
        setState((s) => {
          // 已传输部分数据 → 可从下一块续传；否则从头开始
          const resumeChunk = s.sentSize > 0 ? s.currentChunk + 1 : 0;
          // 检查是否还能自动重试
          const retryCount = s.autoRetryCount || 0;
          if (retryCount < MAX_AUTO_RETRIES) {
            // 进入 retrying 状态，稍后会自动重试
            return { ...s, status: 'retrying', waiting: false, resumeChunk, errorMessage: e.payload.error, autoRetryCount: retryCount + 1 };
          }
          return { ...s, status: 'failed', waiting: false, resumeChunk, errorMessage: e.payload.error, autoRetryCount: 0 };
        });
      });
      unlisteners.current = [un1, un2, un3];
    };
    setup();
    return () => {
      unlisteners.current.forEach((fn) => fn());
      unlisteners.current = [];
      clearAutoRetry();
    };
  }, [clearAutoRetry]);

  // 当状态变为 retrying 时，自动启动重试定时器
  useEffect(() => {
    if (state.status === 'retrying') {
      clearAutoRetry();
      autoRetryTimer.current = setTimeout(() => {
        const cur = stateRef.current;
        if (cur.status !== 'retrying') return;
        // 手机端采用全量覆盖接收：自动重试一律从头重传（不做块级续传，保证数据一致）
        doInvokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0, isAutoRetry: true });
      }, AUTO_RETRY_DELAY);
    }
    return () => {
      // 清理只清理自己设置的定时器，而不影响 autoRetryTimer 跨渲染
    };
  }, [state.status, state.autoRetryCount, clearAutoRetry]);

  const doInvokePush = useCallback(async ({ themeId, deviceId, startChunk = 0, isAutoRetry = false }: StartOpts & { isAutoRetry?: boolean }) => {
    setState((s) => ({
      ...s,
      themeId,
      deviceId,
      resumeChunk: startChunk,
      status: isAutoRetry ? 'retrying' : 'awaiting_confirm',
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
        status: 'awaiting_confirm',
        stage: 'start',
        totalSize: result.totalSize,
        totalChunks: result.totalChunks,
      }));
    } catch (e) {
      setState((s) => {
        const retryCount = s.autoRetryCount || 0;
        if (retryCount < MAX_AUTO_RETRIES) {
          return { ...s, status: 'retrying', errorMessage: String(e), autoRetryCount: retryCount + 1 };
        }
        return { ...s, status: 'failed', errorMessage: String(e), autoRetryCount: 0 };
      });
    }
  }, []);

  const startPush = useCallback(async (themeId: string, deviceIds: string[]) => {
    clearAutoRetry();
    // 如果没有设备则直接返回
    if (!deviceIds || deviceIds.length === 0) return;
    // 逐个设备顺序推送，UI 会随每次 startPush 更新 deviceId 状态
    for (let i = 0; i < deviceIds.length; i++) {
      const devId = deviceIds[i];
      // 为当前设备重置状态（保留 themeId）
      setState(() => ({ ...INITIAL_PUSH_STATE, autoRetryCount: 0, themeId, deviceId: devId }));
      // eslint-disable-next-line no-await-in-loop
      await doInvokePush({ themeId, deviceId: devId, startChunk: 0 });
    }
  }, [doInvokePush, clearAutoRetry]);

  /**
   * 断点续传（兼容保留）：手机端采用全量覆盖接收，续传即从头重传。
   */
  const resumePush = useCallback(() => {
    clearAutoRetry();
    const cur = stateRef.current;
    if (!cur.themeId || !cur.deviceId) return;
    setState((s) => ({ ...s, autoRetryCount: 0 }));
    doInvokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0 });
  }, [doInvokePush, clearAutoRetry]);

  /** 重传：从头开始 */
  const retryPush = useCallback(() => {
    clearAutoRetry();
    const cur = stateRef.current;
    if (!cur.themeId || !cur.deviceId) return;
    setState((s) => ({ ...s, autoRetryCount: 0 }));
    doInvokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0 });
  }, [doInvokePush, clearAutoRetry]);

  /** 取消自动重试（回到 failed 状态让用户手动操作） */
  const cancelAutoRetry = useCallback(() => {
    clearAutoRetry();
    setState((s) => ({ ...s, status: 'failed', autoRetryCount: 0 }));
  }, [clearAutoRetry]);

  const cancelPush = useCallback(async () => {
    clearAutoRetry();
    const cur = stateRef.current;
    if (cur.deviceId && cur.themeId) {
      try {
        await sendPushCancel(cur.themeId, cur.deviceId);
      } catch { /* ignore */ }
    }
    setState((s) => ({ ...s, status: 'cancelled' }));
  }, [clearAutoRetry]);

  const reset = useCallback(() => {
    clearAutoRetry();
    setState(() => ({ ...INITIAL_PUSH_STATE, autoRetryCount: 0 }));
  }, [clearAutoRetry]);

  return { state, startPush, resumePush, retryPush, cancelPush, cancelAutoRetry, reset };
}