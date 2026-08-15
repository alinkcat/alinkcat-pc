import { useEditorStore } from '../store/editorStore';
import { PlusOutlined } from '@ant-design/icons';

export default function PageTabs({ onAddPage }: { onAddPage: () => void }) {
  const { theme, activePageIdx, setActivePage } = useEditorStore();
  return (
    <div className="pt-bar">
      {theme.pages.map((p, i) => (
        <div key={p.id} className={`pt-tab${i === activePageIdx ? ' active' : ''}`}
          onClick={() => setActivePage(i)}>{p.label}</div>
      ))}
      <div className="pt-add" onClick={onAddPage} title="添加页面"><PlusOutlined /></div>
    </div>
  );
}
