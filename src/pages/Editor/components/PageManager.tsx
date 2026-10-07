import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../store/editorStore';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Popconfirm, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, HolderOutlined } from '@ant-design/icons';

const { Text } = Typography;

function SortableRow({ page, idx, isActive }: { page: { id: string; label: string; layoutMode: string; columns: number; rows: number; widgets: unknown[] }; idx: number; isActive: boolean }) {
  const { t } = useTranslation();
  const { setActivePage, removePage } = useEditorStore();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: page.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`pp-page${isActive ? ' active' : ''}`} onClick={() => setActivePage(idx)}>
      <span className="pp-drag" {...attributes} {...listeners}><HolderOutlined /></span>
      <div className="pp-page-info">
        <Text strong style={{ fontSize: 13, color: '#e0e0e0' }}>{page.label}</Text>
        <Text style={{ fontSize: 11, color: '#888' }}>
          {page.layoutMode === 'grid'
            ? t('editor.pageManager.gridInfo', { cols: page.columns, rows: page.rows })
            : t('editor.pageManager.freeLayout')} · {t('editor.pageManager.widgetCount', { count: page.widgets.length })}
        </Text>
      </div>
      <div onClick={e => e.stopPropagation()}>
        <Popconfirm title={t('editor.pageManager.confirmDelete')} onConfirm={() => removePage(idx)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </div>
    </div>
  );
}

export default function PageManager({ onAddPage }: { onAddPage: () => void }) {
  const { t } = useTranslation();
  const { theme, activePageIdx, reorderPages } = useEditorStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = theme.pages.map(p => p.id);
    const o = ids.indexOf(active.id as string), n = ids.indexOf(over.id as string);
    if (o >= 0 && n >= 0) reorderPages(o, n);
  };
  return (
    <div className="ep-section">
      <div className="ep-title">{t('editor.pageManager.title')}</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={theme.pages.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {theme.pages.map((p, i) => <SortableRow key={p.id} page={p} idx={i} isActive={i === activePageIdx} />)}
        </SortableContext>
      </DndContext>
      <Button type="primary" ghost icon={<PlusOutlined />} block size="small" style={{ marginTop: 8 }} onClick={onAddPage}>{t('editor.pageManager.addPage')}</Button>
    </div>
  );
}
