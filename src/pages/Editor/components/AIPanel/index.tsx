import { useAIStore } from '../../../../store/aiStore';
import AIPanelHeader from './AIPanelHeader';
import AIPanelMessages from './AIPanelMessages';
import AIPanelInput from './AIPanelInput';
import AIPanelHistory from './AIPanelHistory';
import AIPanelSettings from './AIPanelSettings';

export default function AIPanel() {
  const { panelHeight, panelCollapsed, setPanelHeight, togglePanel } = useAIStore();

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelHeight;

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(600, Math.max(120, startH + (startY - ev.clientY)));
      setPanelHeight(Math.round(next));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="ai-panel" style={panelCollapsed ? undefined : { height: panelHeight }}>
      <AIPanelHeader onDragStart={handleDragStart} onDoubleClick={togglePanel} />
      {!panelCollapsed && (
        <>
          <AIPanelMessages />
          <AIPanelInput />
        </>
      )}
      <AIPanelHistory />
      <AIPanelSettings />
    </div>
  );
}
