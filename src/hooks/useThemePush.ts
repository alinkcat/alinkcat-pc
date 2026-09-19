import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriInvoke } from '../utils/tauri';
import { sendPushCancel } from './useWebSocket';
import type { PushState, PushProgressEvent, PushResult } from '../types/push';
import { INITIAL_PUSH_STATE } from '../types/push';

type StartOpts = {
  themeId: string;
  deviceId: string; // single-device internal use
  startChunk?: number;
};

const AUTO_RETRY_DELAY = 3000; // auto-retry after 3 seconds
const MAX_AUTO_RETRIES = 2;    // at most 2 retries

/**
 * theme package push Hook：
 * - push_theme_to_device(backend chunked push + awaiting_confirm + busy/timeout retry）
 * - listen for Tauri event theme-push-progress / theme-push-complete / theme-push-failed
 * - on failure supports resume and re-send」
 * - auto-retry: on failure wait 3s then retry，at most 2 times，user can cancel
 */
export function useThemePush() {
  const [state, setState] = useState<PushState & { autoRetryCount: number }>({ ...INITIAL_PUSH_STATE, autoRetryCount: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const unlisteners = useRef<UnlistenFn[]>([]);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // clear the auto-retry timer
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
          // partial data transferred → resume from next chunk; otherwise start over
          const resumeChunk = s.sentSize > 0 ? s.currentChunk + 1 : 0;
          // check if auto-retry is still possible
          const retryCount = s.autoRetryCount || 0;
          if (retryCount < MAX_AUTO_RETRIES) {
            // enter retrying state, will auto-retry shortly
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

  // when state becomes retrying, auto-start the retry timer
  useEffect(() => {
    if (state.status === 'retrying') {
      clearAutoRetry();
      autoRetryTimer.current = setTimeout(() => {
        const cur = stateRef.current;
        if (cur.status !== 'retrying') return;
        // phone uses full-overwrite receive: auto-retry always re-sends from scratch (no chunk-level resume, ensures data consistency)
        doInvokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0, isAutoRetry: true });
      }, AUTO_RETRY_DELAY);
    }
    return () => {
      // cleanup only clears its own timer, does not affect autoRetryTimer across renders
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
    // if no devices, return directly
    if (!deviceIds || deviceIds.length === 0) return;
    // push to each device sequentially; UI updates deviceId status on each startPush
    for (let i = 0; i < deviceIds.length; i++) {
      const devId = deviceIds[i];
      // reset state for the current device (keep themeId)
      setState(() => ({ ...INITIAL_PUSH_STATE, autoRetryCount: 0, themeId, deviceId: devId }));
      // eslint-disable-next-line no-await-in-loop
      await doInvokePush({ themeId, deviceId: devId, startChunk: 0 });
    }
  }, [doInvokePush, clearAutoRetry]);

  /**
   * resume (kept for compat): the phone receives a full overwrite, so resume means re-sending from scratch。
   */
  const resumePush = useCallback(() => {
    clearAutoRetry();
    const cur = stateRef.current;
    if (!cur.themeId || !cur.deviceId) return;
    setState((s) => ({ ...s, autoRetryCount: 0 }));
    doInvokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0 });
  }, [doInvokePush, clearAutoRetry]);

  /** re-send: start from scratch */
  const retryPush = useCallback(() => {
    clearAutoRetry();
    const cur = stateRef.current;
    if (!cur.themeId || !cur.deviceId) return;
    setState((s) => ({ ...s, autoRetryCount: 0 }));
    doInvokePush({ themeId: cur.themeId, deviceId: cur.deviceId, startChunk: 0 });
  }, [doInvokePush, clearAutoRetry]);

  /** cancel auto-retry (return to failed state for manual action) */
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