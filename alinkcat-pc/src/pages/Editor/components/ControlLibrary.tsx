import { useDraggable } from '@dnd-kit/core';
import { AppstoreOutlined, DashboardOutlined, FormOutlined, PictureOutlined, FontSizeOutlined, BorderOutlined, GlobalOutlined, CustomerServiceOutlined, MonitorOutlined, ThunderboltOutlined, RocketOutlined, ClockCircleOutlined, FieldTimeOutlined, CalendarOutlined } from '@ant-design/icons';

const TYPES = [
  { type: 'quick-action', icon: <ThunderboltOutlined />, label: '快捷面板', color: '#4F6EF7' },
  { type: 'launcher', icon: <RocketOutlined />, label: '应用启动', color: '#722ed1' },
  { type: 'button', icon: <AppstoreOutlined />, label: '快捷操作', color: '#4F6EF7' },
  { type: 'gauge', icon: <DashboardOutlined />, label: '数据表盘', color: '#52c41a' },
  { type: 'snippet-list', icon: <FormOutlined />, label: '便签', color: '#faad14' },
  { type: 'clock', icon: <ClockCircleOutlined />, label: '时钟', color: '#2f54eb' },
  { type: 'date', icon: <FieldTimeOutlined />, label: '日期', color: '#13c2c2' },
  { type: 'calendar', icon: <CalendarOutlined />, label: '日历', color: '#eb2f96' },
  { type: 'text', icon: <FontSizeOutlined />, label: '文本标签', color: '#eb2f96' },
  { type: 'shape', icon: <BorderOutlined />, label: '形状', color: '#13c2c2' },
  { type: 'system-monitor', icon: <MonitorOutlined />, label: '系统监控', color: '#13c2c2' },
  { type: 'media-control', icon: <CustomerServiceOutlined />, label: '媒体控制', color: '#ff4d4f' },
  { type: 'webview', icon: <GlobalOutlined />, label: '网页视图', color: '#2f54eb' },
  { type: 'image', icon: <PictureOutlined />, label: '图片', color: '#722ed1' },
] as const;

function DraggableItem({ type, icon, label, color }: (typeof TYPES)[number]) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib-${type}` });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={`wl-item${isDragging ? ' dragging' : ''}`}
      style={{ opacity: isDragging ? 0.35 : 1 }}>
      <span style={{ color, fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function ControlLibrary() {
  return (
    <div className="wl-panel">
      <div className="wl-title">控件</div>
      {TYPES.map(t => <DraggableItem key={t.type} {...t} />)}
    </div>
  );
}