import { useEffect } from 'react';
import { Drawer, Button, Typography, Space, Empty, List, Modal } from 'antd';
import { DeleteOutlined, PlusOutlined, ExportOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';
import { exportHistory } from '../../../../utils/aiHistory';

const { Text } = Typography;

export default function AIPanelHistory() {
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
      title: '新建会话',
      content: '当前对话将自动保存，确认新建？',
      onOk: newSession,
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessionId === currentSessionId) {
      Modal.confirm({
        title: '删除当前会话',
        content: '当前会话将被删除，确认？',
        onOk: () => deleteSession(sessionId),
      });
    } else {
      deleteSession(sessionId);
    }
  };

  const handleRestoreSession = (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    Modal.confirm({
      title: '切换会话',
      content: '当前对话将自动保存，切换到选中的会话？',
      onOk: () => loadSession(sessionId),
    });
  };

  return (
    <Drawer
      title="对话历史"
      open={historyOpen}
      onClose={toggleHistory}
      size="large"
      extra={
        <Space size={4}>
          <Button size="small" icon={<PlusOutlined />} onClick={handleNewSession}>新建</Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => exportHistory(themeId, messages)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={clearHistory} />
        </Space>
      }
    >
      {sessions.length === 0 ? (
        <Empty description="暂无对话历史" />
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
                    {isActive ? '当前' : '恢复'}
                  </Button>,
                  <Button
                    key="del"
                    type="link"
                    danger
                    size="small"
                    onClick={() => handleDeleteSession(s.id)}
                  >
                    删除
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
                      {s.messageCount} 条消息 · {new Date(s.createdAt).toLocaleString()}
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