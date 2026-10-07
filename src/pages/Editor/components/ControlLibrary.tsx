import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { AppstoreOutlined, DashboardOutlined, FormOutlined, PictureOutlined, FontSizeOutlined, BorderOutlined, GlobalOutlined, CustomerServiceOutlined, MonitorOutlined, ThunderboltOutlined, RocketOutlined, ClockCircleOutlined, FieldTimeOutlined, CalendarOutlined, IdcardOutlined, CloudOutlined } from '@ant-design/icons';

const TYPES = [
  { type: 'quick-action', icon: <ThunderboltOutlined />, color: '#4F6EF7' },
  { type: 'launcher', icon: <RocketOutlined />, color: '#722ed1' },
  { type: 'button', icon: <AppstoreOutlined />, color: '#4F6EF7' },
  { type: 'gauge', icon: <DashboardOutlined />, color: '#52c41a' },
  { type: 'battery', icon: <DashboardOutlined />, color: '#52c41a' },
  { type: 'snippet-list', icon: <FormOutlined />, color: '#faad14' },
  { type: 'clock', icon: <ClockCircleOutlined />, color: '#2f54eb' },
  { type: 'date', icon: <FieldTimeOutlined />, color: '#13c2c2' },
  { type: 'calendar', icon: <CalendarOutlined />, color: '#eb2f96' },
  { type: 'text', icon: <FontSizeOutlined />, color: '#eb2f96' },
  { type: 'shape', icon: <BorderOutlined />, color: '#13c2c2' },
  { type: 'system-monitor', icon: <MonitorOutlined />, color: '#13c2c2' },
  { type: 'media-control', icon: <CustomerServiceOutlined />, color: '#ff4d4f' },
  { type: 'webview', icon: <GlobalOutlined />, color: '#2f54eb' },
  { type: 'weather', icon: <CloudOutlined />, color: '#f5a623' },
  { type: 'image', icon: <PictureOutlined />, color: '#722ed1' },
  { type: 'card', icon: <IdcardOutlined />, color: '#722ed1' },
] as const;

function DraggableItem({ type, icon, color }: (typeof TYPES)[number]) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib-${type}` });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={`wl-item${isDragging ? ' dragging' : ''}`}
      style={{ opacity: isDragging ? 0.35 : 1 }}>
      <span style={{ color, fontSize: 16 }}>{icon}</span>
      <span>{t(`editor.controlLibrary.${type}`)}</span>
    </div>
  );
}

export default function ControlLibrary() {
  const { t } = useTranslation();
  return (
    <div className="wl-panel">
      <div className="wl-title">{t('editor.controlLibrary.title')}</div>
      {TYPES.map(t => <DraggableItem key={t.type} {...t} />)}
    </div>
  );
}