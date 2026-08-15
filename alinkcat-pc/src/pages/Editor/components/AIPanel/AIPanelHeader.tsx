import { useTranslation } from 'react-i18next';
import { Select, Button, Tooltip, Space, Typography } from 'antd';
import { HistoryOutlined, ClearOutlined, SettingOutlined, HolderOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';

const { Text } = Typography;

interface Props {
  onDragStart: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export default function AIPanelHeader({ onDragStart, onDoubleClick }: Props) {
  const { t } = useTranslation();
  const { config, model, setModel, toggleHistory, toggleSettings, clearHistory, messages } = useAIStore();

  return (
    <div className="ai-header" onDoubleClick={onDoubleClick}>
      <span className="ai-drag-handle" onMouseDown={onDragStart} title={t('editor.aiPanel.dragHint')}>
        <HolderOutlined />
      </span>
      <Text strong style={{ fontSize: 13, color: '#e0e0e0' }}>{t('editor.aiPanel.title')}</Text>
      <Space size={4} style={{ marginLeft: 'auto' }}>
        <Select
          size="small"
          value={model}
          onChange={setModel}
          style={{ width: 150 }}
          options={config.models.map((m) => ({ label: m, value: m }))}
        />
        <Tooltip title={t('editor.aiPanel.history')}>
          <Button size="small" type="text" icon={<HistoryOutlined />} onClick={toggleHistory} />
        </Tooltip>
        <Tooltip title={t('editor.aiPanel.clear')}>
          <Button size="small" type="text" icon={<ClearOutlined />} disabled={messages.length === 0} onClick={clearHistory} />
        </Tooltip>
        <Tooltip title={t('editor.aiPanel.settings')}>
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={toggleSettings} />
        </Tooltip>
      </Space>
    </div>
  );
}
