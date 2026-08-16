import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { Button, Space, Typography, Modal, Form, Input, Select, Slider, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, ExportOutlined, MobileOutlined, TabletOutlined, FolderOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { tauriInvoke } from '../../utils/tauri';
import ThemeFileManager from '../../components/ThemeFileManager';
import { useEditorStore, editorToThemeMeta } from './store/editorStore';
import { usePanelResize } from './hooks/useResize';
import { generateThemeCover, generateDefaultCover } from '../../utils/coverGenerator';
import { migrateImagesToAssets } from '../../utils/coverHelper';
import { resolveThemeImages } from '../../utils/assetHelper';
import { getTemplateById, cloneTemplate } from '../../templates';
import type { ThemeMeta } from '../../types/theme';
import ControlLibrary from './components/ControlLibrary';
import PreviewArea from './components/PreviewArea';
import PropertyPanel from './components/PropertyPanel';
import PageTabs from './components/PageTabs';
import AIPanel from './components/AIPanel';
import { useAIStore } from '../../store/aiStore';

const { Text } = Typography;

const LIB_LABELS: Record<string, string> = {
  'lib-button': 'editor.controlLibrary.button', 'lib-gauge': 'editor.controlLibrary.gauge',
  'lib-snippet-list': 'editor.controlLibrary.snippet-list', 'lib-text': 'editor.controlLibrary.text', 'lib-shape': 'editor.controlLibrary.shape', 'lib-system-monitor': 'editor.controlLibrary.system-monitor', 'lib-media-control': 'editor.controlLibrary.media-control', 'lib-quick-action': 'editor.controlLibrary.quick-action', 'lib-launcher': 'editor.controlLibrary.launcher', 'lib-webview': 'editor.controlLibrary.webview', 'lib-image': 'editor.controlLibrary.image',
};

function AddPageModal({ open, onOk, onCancel }: {
  open: boolean; onOk: (label: string, mode: 'grid' | 'free') => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  return (
    <Modal title={t('editor.addPageModal.title')} open={open} onCancel={onCancel} destroyOnHidden width={400}
      onOk={() => form.validateFields().then(v => { onOk(v.label, v.mode); form.resetFields(); })}>
      <Form form={form} layout="vertical" initialValues={{ label: t('editor.addPageModal.newPage'), mode: 'grid' }}>
        <Form.Item name="label" label={t('editor.addPageModal.pageName')} rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="mode" label={t('editor.addPageModal.layoutMode')}>
          <Select options={[{ label: t('editor.addPageModal.gridLayout'), value: 'grid' }, { label: t('editor.addPageModal.freeLayout'), value: 'free' }]} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function Editor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const templateId = searchParams.get('template');

  const { theme, orientation, zoom, saving, exporting, loadTheme, replaceTheme, initNewTheme, toggleOrientation, setZoom, setSaving, setExporting, addPage, addWidgetAt } = useEditorStore();
  const initAITheme = useAIStore((s) => s.initTheme);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [fileMgrOpen, setFileMgrOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const leftPanel = usePanelResize(110, 'editor-left-w', 80, 200);
  const rightPanel = usePanelResize(260, 'editor-right-w', 200, 400);

  useEffect(() => {
    if (isNew) {
      if (templateId) {
        const tpl = getTemplateById(templateId);
        if (tpl) {
          const cloned = cloneTemplate(tpl);
          // 生成新 ID 防止冲突
          cloned.id = `theme-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          replaceTheme(cloned);
        } else {
          initNewTheme();
        }
      } else {
        initNewTheme();
      }
    } else if (id) {
      tauriInvoke<ThemeMeta>('load_theme', { id })
        .then(async (meta) => {
          // 将相对图片路径解析为 data URL，确保背景图/控件图正常显示
          const resolved = await resolveThemeImages(meta);
          loadTheme(resolved);
          // 加载该主题包的 AI 对话历史
          initAITheme(id);
        })
        .catch(e => message.error(String(e)));
    }
  }, [id, isNew, templateId, loadTheme, initNewTheme, initAITheme]);

  // Ctrl+Z 撤销 AI 执行的操作
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const restored = useAIStore.getState().restoreLastSnapshot();
        if (restored) e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('mousemove', h);
    return () => document.removeEventListener('mousemove', h);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const aid = active.id as string;
    if (!aid.startsWith('lib-')) return;
    const type = aid.replace('lib-', '');
    const el = document.querySelector('.canvas') as HTMLElement | null;
    if (el) {
      const rect = el.getBoundingClientRect();
      const st = useEditorStore.getState();
      const pg = st.theme.pages[st.activePageIdx];
      if (pg) {
        const cols = pg.columns, rows = pg.rows;
        const cw = rect.width / cols, ch = rect.height / rows;
        const col = Math.max(0, Math.min(cols - 1, Math.floor((mousePosRef.current.x - rect.left) / cw)));
        const row = Math.max(0, Math.min(rows - 1, Math.floor((mousePosRef.current.y - rect.top) / ch)));
        addWidgetAt(type, col, row);
        return;
      }
    }
    addWidgetAt(type, 0, 0);
  };

  const handleSave = useCallback(async () => {
    if (!theme.id) return message.warning(t('editor.messages.needThemeId'));
    if (!theme.name) return message.warning(t('editor.messages.needThemeName'));
    setSaving(true);
    try {
      // 将 base64 图片迁移到 assets/ 目录，引用改为相对路径
      const themeMeta = await migrateImagesToAssets(editorToThemeMeta(theme));
      // 生成封面图（失败时降级为默认占位封面）
      let coverData: string | null = null;
      try {
        coverData = themeMeta.pages.length > 0
          ? await generateThemeCover(themeMeta)
          : await generateDefaultCover(themeMeta.name);
      } catch {
        coverData = null;
      }
      await tauriInvoke('save_theme', { theme: themeMeta, coverPath: null, coverData });
      message.success(t('editor.messages.saved'));
    } catch (e) { message.error(String(e)); }
    finally { setSaving(false); }
  }, [theme, setSaving]);

  // Ctrl+S / Cmd+S 保存
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const handleExport = async () => {
    try {
      await handleSave();
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: `${theme.name || theme.id}_${theme.version || '1.0.0'}.alc`,
        filters: [{ name: t('editor.toolbar.alcFilter'), extensions: ['alc'] }],
      });
      if (!path) return;
      setExporting(true);
      try {
        await tauriInvoke('export_theme', { id: theme.id, outputPath: path });
        message.success(t('editor.messages.exported'));
      } finally {
        setExporting(false);
      }
    } catch (e) { message.error(String(e)); }
  };

  const totalWidgets = theme.pages.reduce((s, p) => s + p.widgets.length, 0);

  return (
    <div className="editor-root">
      <div className="editor-toolbar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/themes')}>{t('editor.toolbar.back')}</Button>
        <Text strong style={{ fontSize: 14, color: '#e0e0e0' }}>{isNew ? t('editor.toolbar.newTheme') : t('editor.toolbar.editing', { name: theme.name || theme.id })}</Text>
        <Space>
          <Button size="small" icon={orientation === 'portrait' ? <MobileOutlined /> : <TabletOutlined />} onClick={toggleOrientation}>
            {orientation === 'portrait' ? t('editor.toolbar.portrait') : t('editor.toolbar.landscape')}
          </Button>
          <Slider min={50} max={150} value={zoom} onChange={setZoom} style={{ width: 100 }} tooltip={{ formatter: v => `${v}%` }} />
          <Button icon={<ExportOutlined />} loading={exporting} onClick={handleExport} disabled={!theme.id}>{t('editor.toolbar.export')}</Button>
          <Button icon={<FolderOutlined />} onClick={() => setFileMgrOpen(true)} disabled={!theme.id}>{t('editor.toolbar.file')}</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('editor.toolbar.save')}</Button>
        </Space>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="editor-body">
          <div style={{ width: leftPanel.width, flexShrink: 0, overflow: 'hidden' }}><ControlLibrary /></div>
          <div className="editor-divider" onMouseDown={leftPanel.onMouseDown} />
          <PreviewArea />
          <div className="editor-divider" onMouseDown={rightPanel.onRightMouseDown} />
          <div style={{ width: rightPanel.width, flexShrink: 0, overflow: 'hidden' }}>
            <PropertyPanel onAddPage={() => setAddPageOpen(true)} />
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeId && LIB_LABELS[activeId] && <div className="drag-preview">{t(LIB_LABELS[activeId])}</div>}
        </DragOverlay>
      </DndContext>

      <AIPanel />
      <PageTabs onAddPage={() => setAddPageOpen(true)} />
      <div className="editor-statusbar">
        <span>{t('editor.statusbar.widgets', { count: totalWidgets })}</span>
        <span>{t('editor.statusbar.pages', { count: theme.pages.length })}</span>
        <span>{orientation === 'portrait' ? t('editor.statusbar.portrait') : t('editor.statusbar.landscape')}</span>
      </div>

      <AddPageModal open={addPageOpen} onOk={(label, mode) => { addPage(label, mode); setAddPageOpen(false); }} onCancel={() => setAddPageOpen(false)} />
      <ThemeFileManager themeId={theme.id} open={fileMgrOpen} onClose={() => setFileMgrOpen(false)} />
    </div>
  );
}
