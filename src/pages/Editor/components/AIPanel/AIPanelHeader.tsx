import { Select, Button, Tooltip, Space, Typography } from 'antd';
import { HistoryOutlined, ClearOutlined, SettingOutlined, HolderOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';

const { Text } = Typography;

interface Props {
  onDragStart: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

const TIP_DRAG = '\u62d6\u62fd\u8c03\u6574\u9ad8\u5ea6\uff0c\u53cc\u51fb\u6298\u53e0/\u5c55\u5f00';
const TITLE = '\ud83e\udd16 AI \u52a9\u624b';
const T_HISTORY = '\u5386\u53f2\u8bb0\u5f55';
const T_CLEAR = '\u6e05\u7a7a\u5bf9\u8bdd';
const T_SETTINGS = 'AI \u8bbe\u7f6e';

export default function AIPanelHeader({ onDragStart, onDoubleClick }: Props) {
  const { config, model, setModel, toggleHistory, toggleSettings, clearHistory, messages } = useAIStore();

  return (
    <div className="ai-header" onDoubleClick={onDoubleClick}>
      <span className="ai-drag-handle" onMouseDown={onDragStart} title={TIP_DRAG}>
        <HolderOutlined />
      </span>
      <Text strong style={{ fontSize: 13, color: '#e0e0e0' }}>{TITLE}</Text>
      <Space size={4} style={{ marginLeft: 'auto' }}>
        <Select
          size="small"
          value={model}
          onChange={setModel}
          style={{ width: 150 }}
          options={config.models.map((m) => ({ label: m, value: m }))}
        />
        <Tooltip title={T_HISTORY}>
          <Button size="small" type="text" icon={<HistoryOutlined />} onClick={toggleHistory} />
        </Tooltip>
        <Tooltip title={T_CLEAR}>
          <Button size="small" type="text" icon={<ClearOutlined />} disabled={messages.length === 0} onClick={clearHistory} />
        </Tooltip>
        <Tooltip title={T_SETTINGS}>
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={toggleSettings} />
        </Tooltip>
      </Space>
    </div>
  );
}
