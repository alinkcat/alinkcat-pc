import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { Drawer, Button, Typography, Space, Empty, List, Modal } from 'antd';
import { DeleteOutlined, PlusOutlined, ExportOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';
import { exportHistory } from '../../../../utils/aiHistory';

const { Text } = Typography;

export default function AIPanelHistory() {
  const { t } = useTranslation();
  const {
    historyOpen, toggleHistory, messages, themeId,
    sessions, currentSessionId,
    newSession, loadSession, deleteSession, clearHistory,
  } = useAIStore();

  useEffect(() => {
    // sessions 已在 initTheme 中加载
  }, [themeId, historyOpen]);

  const handleNewSession = () => {
    Modal.confirm({
      title: t('editor.aiPanel.newSession'),
      content: t('editor.aiPanel.newSessionContent'),
      onOk: newSession,
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessionId === currentSessionId) {
      Modal.confirm({
        title: t('editor.aiPanel.deleteSession'),
        content: t('editor.aiPanel.deleteSessionContent'),
        onOk: () => deleteSession(sessionId),
      });
    } else {
      deleteSession(sessionId);
    }
  };

  const handleRestoreSession = (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    Modal.confirm({
      title: t('editor.aiPanel.switchSession'),
      content: t('editor.aiPanel.switchSessionContent'),
      onOk: () => loadSession(sessionId),
    });
  };

  return (
    <Drawer
      title={t('editor.aiPanel.historyTitle')}
      open={historyOpen}
      onClose={toggleHistory}
      size="large"
      extra={
        <Space size={4}>
          <Button size="small" icon={<PlusOutlined />} onClick={handleNewSession}>{t('editor.aiPanel.newBtn')}</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportHistory(themeId, messages)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={clearHistory} />
        </Space>
      }
    >
      {sessions.length === 0 ? (
        <Empty description={t('editor.aiPanel.emptyHistory')} />
      ) : (
        <List
          dataSource={sessions}
          size="small"
          renderItem={(s) => {
            const isActive = s.id === currentSessionId;
            return (
              <List.Item
                style={{
                  background: isActive ? 'rgba(79,110,247,0.08)' : undefined,
                  borderRadius: 4,
                }}
                actions={[
                  <Button
                    key="restore"
                    type={isActive ? 'primary' : 'link'}
                    size="small"
                    disabled={isActive}
                    onClick={() => handleRestoreSession(s.id)}
                  >
                    {isActive ? t('editor.aiPanel.current') : t('editor.aiPanel.restore')}
                  </Button>,
                  <Button
                    key="del"
                    type="link"
                    danger
                    size="small"
                    onClick={() => handleDeleteSession(s.id)}
                  >
                    {t('editor.aiPanel.delete')}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Text style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }} ellipsis={{ tooltip: s.title }}>
                      {s.title}
                    </Text>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('editor.aiPanel.messageCount', { count: s.messageCount })} · {new Date(s.createdAt).toLocaleString()}
                    </Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
}