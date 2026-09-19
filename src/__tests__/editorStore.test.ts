import { describe, it, expect } from 'vitest';
import { makeWidget, nextFree, themeToEditor, editorToThemeMeta } from '../pages/Editor/store/editorStore';
import type { EditorWidget } from '../pages/Editor/types';
import type { ThemeMeta, PageDefinition } from '../types/theme';

describe('makeWidget', () => {
  it('returns a button widget with correct properties at (0,0)', () => {
    const w = makeWidget('button', 0, 0);
    expect(w.type).toBe('button');
    expect(w.gridCol).toBe(0);
    expect(w.gridRow).toBe(0);
    expect(w.gridW).toBe(1);
    expect(w.gridH).toBe(1);
    expect(w.id).toMatch(/^w-/);
    expect(w.label).toBe('');
    // button-specific properties
    const btn = w as { icon?: string; action?: unknown };
    expect(btn.icon).toBe('🔘');
    expect(btn.action).toEqual({ type: 'keyboard', keys: [] });
  });

  it('returns a clock widget with correct properties at (2,3)', () => {
    const w = makeWidget('clock', 2, 3);
    expect(w.type).toBe('clock');
    expect(w.gridCol).toBe(2);
    expect(w.gridRow).toBe(3);
    expect(w.gridW).toBe(1);
    expect(w.gridH).toBe(1);
    // clock-specific properties
    const clock = w as { format24h?: boolean; showSeconds?: boolean; showAmpm?: boolean };
    expect(clock.format24h).toBe(true);
    expect(clock.showSeconds).toBe(true);
    expect(clock.showAmpm).toBe(true);
  });

  it('returns a gauge widget with ring style', () => {
    const w = makeWidget('gauge', 0, 0);
    expect(w.type).toBe('gauge');
    const gauge = w as { gaugeStyle?: string; ringColorLow?: string };
    expect(gauge.gaugeStyle).toBe('ring');
    expect(gauge.ringColorLow).toBe('#52c41a');
  });

  it('returns a text widget with default content', () => {
    const w = makeWidget('text', 0, 0);
    expect(w.type).toBe('text');
    const text = w as { content?: string; fontSize?: number };
    expect(text.content).toBe('Double-click to edit text');
    expect(text.fontSize).toBe(16);
  });

  it('returns a calendar widget with default grid span', () => {
    const w = makeWidget('calendar', 0, 0);
    expect(w.type).toBe('calendar');
    expect(w.gridW).toBe(2);
    expect(w.gridH).toBe(3);
  });
});

describe('nextFree', () => {
  it('returns [0, 0] for empty widget list', () => {
    expect(nextFree([], 4, 6)).toEqual([0, 0]);
  });

  it('returns [1, 0] when (0,0) is occupied', () => {
    const widgets = [
      { id: 'w1', gridCol: 0, gridRow: 0 },
    ] as EditorWidget[];
    expect(nextFree(widgets, 4, 6)).toEqual([1, 0]);
  });

  it('returns first free cell skipping occupied cells', () => {
    const widgets = [
      { id: 'w1', gridCol: 0, gridRow: 0 },
      { id: 'w2', gridCol: 1, gridRow: 0 },
      { id: 'w3', gridCol: 2, gridRow: 0 },
    ] as EditorWidget[];
    expect(nextFree(widgets, 4, 6)).toEqual([3, 0]);
  });

  it('wraps to next row when first row is full', () => {
    const widgets = [
      { id: 'w1', gridCol: 0, gridRow: 0 },
      { id: 'w2', gridCol: 1, gridRow: 0 },
      { id: 'w3', gridCol: 2, gridRow: 0 },
      { id: 'w4', gridCol: 3, gridRow: 0 },
    ] as EditorWidget[];
    expect(nextFree(widgets, 4, 6)).toEqual([0, 1]);
  });
});

describe('themeToEditor', () => {
  it('converts a ThemeMeta to EditorTheme with correct page layout', () => {
    const meta: ThemeMeta = {
      id: 'test-id',
      name: 'Test Theme',
      version: '1.0.0',
      author: 'Tester',
      description: 'A test theme',
      pages: [
        {
          id: 'page-1',
          label: 'Page 1',
          layout: { type: 'grid', columns: 4, rows: 6 },
          widgets: [
            {
              id: 'w1', type: 'clock', label: 'Clock',
              gridCol: 0, gridRow: 0, gridW: 1, gridH: 1,
              freeX: 10, freeY: 10, freeW: 30, freeH: 15,
              format24h: true, showSeconds: true,
            },
          ],
        } as PageDefinition,
      ],
    };

    const editorTheme = themeToEditor(meta);
    expect(editorTheme.id).toBe('test-id');
    expect(editorTheme.name).toBe('Test Theme');
    expect(editorTheme.pages).toHaveLength(1);
    expect(editorTheme.pages[0].layoutMode).toBe('grid');
    expect(editorTheme.pages[0].columns).toBe(4);
    expect(editorTheme.pages[0].rows).toBe(6);
    expect(editorTheme.pages[0].widgets).toHaveLength(1);
    expect(editorTheme.pages[0].widgets[0].type).toBe('clock');
    expect(editorTheme.pages[0].widgets[0].gridCol).toBe(0);
  });

  it('preserves widget-specific properties through conversion', () => {
    const meta: ThemeMeta = {
      id: 'test-2',
      name: 'Test 2',
      version: '1.0.0',
      author: 'Tester',
      pages: [
        {
          id: 'p1', label: 'P1',
          layout: { type: 'grid', columns: 4, rows: 6 },
          widgets: [
            {
              id: 'wg', type: 'gauge', label: 'CPU',
              gridCol: 0, gridRow: 0, gridW: 1, gridH: 1,
              freeX: 10, freeY: 10, freeW: 30, freeH: 15,
              gaugeStyle: 'ring', unit: '%', minValue: 0, maxValue: 100,
            },
          ],
        } as PageDefinition,
      ],
    };

    const editorTheme = themeToEditor(meta);
    const gauge = editorTheme.pages[0].widgets[0] as unknown as Record<string, unknown>;
    expect(gauge.gaugeStyle).toBe('ring');
    expect(gauge.unit).toBe('%');
    expect(gauge.minValue).toBe(0);
    expect(gauge.maxValue).toBe(100);
  });
});

describe('editorToThemeMeta', () => {
  it('converts EditorTheme to ThemeMeta with correct layout type', () => {
    const editorTheme = {
      id: 'test-id',
      name: 'Test Theme',
      version: '1.0.0',
      author: 'Tester',
      description: 'A test theme',
      pages: [
        {
          id: 'page-1',
          label: 'Page 1',
          layoutMode: 'grid' as const,
          columns: 4,
          rows: 6,
          widgets: [
            makeWidget('clock', 0, 0),
          ],
        },
      ],
    };

    const themeMeta = editorToThemeMeta(editorTheme);
    expect(themeMeta.id).toBe('test-id');
    expect(themeMeta.pages).toHaveLength(1);
    expect(themeMeta.pages[0].layout.type).toBe('grid');
    expect(themeMeta.pages[0].layout.columns).toBe(4);
    expect(themeMeta.pages[0].layout.rows).toBe(6);
  });
});