import { useEffect, useRef } from 'react';
import { useEditorStore } from '../pages/Editor/store/editorStore';
import type { EditorTheme } from '../pages/Editor/types';

export const DRAFT_KEY = 'ilinkcat_editor_draft';
const DEBOUNCE_MS = 5000;
const DRAFT_MAX_AGE_DAYS = 7;

export interface DraftPayload {
  theme: EditorTheme;
  activePageIdx: number;
  orientation: 'portrait' | 'landscape';
  zoom: number;
  createdAt?: string;
}

/**
 * auto-save hook：watches editorStore changes，debounced 5s then writes to localStorage。
 * only works after the editor is initialized，skip while a save is in progress。
 */
export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const lastSignatureRef = useRef<string>('');

  // mark editor as ready（first render done + init logic executed）
  useEffect(() => {
    readyRef.current = true;
  }, []);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (!readyRef.current) return;
      // do not auto-save while saving to disk, avoid overwriting the draft
      if (state.saving) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        // incremental check: skip if theme content hasn't changed, avoid unnecessary serialization
        const signature = JSON.stringify(state.theme);
        if (signature === lastSignatureRef.current) return;
        lastSignatureRef.current = signature;

        const payload: DraftPayload = {
          theme: state.theme,
          activePageIdx: state.activePageIdx,
          orientation: state.orientation,
          zoom: state.zoom,
          createdAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        } catch {
          // localStorage may be full or unavailable, fail silently
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

/** clear the local draft (call after save success) */
export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

/** get the local draft (auto-clear on parse failure or expiry) */
export function getDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as DraftPayload;
    // check if the draft is expired (auto-clear after 7 days)
    if (payload.createdAt) {
      const age = Date.now() - new Date(payload.createdAt).getTime();
      if (age > DRAFT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
    }
    return payload;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}