import { useEffect, useRef } from 'react';
import { useEditorStore } from '../pages/Editor/store/editorStore';
import type { EditorTheme } from '../pages/Editor/types';

export const DRAFT_KEY = 'ilinkcat_editor_draft';
const DEBOUNCE_MS = 5000;

export interface DraftPayload {
  theme: EditorTheme;
  activePageIdx: number;
  orientation: 'portrait' | 'landscape';
  zoom: number;
}

/**
 * 自动保存 hook：监听 editorStore 变化，防抖 5 秒后写入 localStorage。
 * 只在编辑器初始化完成后工作，保存进行中时跳过。
 */
export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);

  // 标记编辑器已就绪（首次渲染完成 + 初始化逻辑已执行）
  useEffect(() => {
    readyRef.current = true;
  }, []);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (!readyRef.current) return;
      // 正在保存到磁盘时不触发自动保存，避免覆盖草稿
      if (state.saving) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        const payload: DraftPayload = {
          theme: state.theme,
          activePageIdx: state.activePageIdx,
          orientation: state.orientation,
          zoom: state.zoom,
        };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch {
          // localStorage 可能已满或不可用，静默失败
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}

/** 清除本地草稿（保存成功后调用） */
export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

/** 获取本地草稿（解析失败时自动清除） */
export function getDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}