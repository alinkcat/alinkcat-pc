import { useTranslation } from 'react-i18next';
import { Button, Space, Typography } from 'antd';
import { useAIStore } from '../../../../store/aiStore';
import type { AIMessage } from '../../../../types/ai';

const { Text, Paragraph } = Typography;

export default function AIPanelMessageItem({ message }: { message: AIMessage }) {
  const { t } = useTranslation();
  const { confirmInstruction, cancelInstruction } = useAIStore();
  const isUser = message.role === 'user';
  const pendingInstrs = (message.instructions || []).filter((i) => !i.confirmed && !i.canceled && !i.executed);
  const hasExecuted = (message.instructions || []).some((i) => i.executed && i.confirmed);

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
      <div className="ai-msg-role">{isUser ? t('editor.aiPanel.roleYou') : t('editor.aiPanel.roleAI')}</div>
      <div className="ai-msg-content">
        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content || (message.status === 'streaming' ? '\u2026' : '')}
        </Paragraph>

        {message.status === 'error' && (
          <Text type="danger" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{message.content}</Text>
        )}

        {pendingInstrs.length > 0 && (
          <div className="ai-instr-confirm">
            <Text style={{ fontSize: 12, color: '#faad14' }}>
              {t('editor.aiPanel.instrDetected')} {pendingInstrs.length} {t('editor.aiPanel.instrCount')}
            </Text>
            <Space size={4}>
              <Button size="small" type="primary"
                onClick={() => pendingInstrs.forEach((i) => confirmInstruction(message.id, i.id))}>
                {t('editor.aiPanel.btnConfirm')}
              </Button>
              <Button size="small"
                onClick={() => pendingInstrs.forEach((i) => cancelInstruction(message.id, i.id))}>
                {t('editor.aiPanel.btnCancel')}
              </Button>
            </Space>
          </div>
        )}

        {hasExecuted && (
          <Text style={{ fontSize: 11, color: '#52c41a', display: 'block', marginTop: 4 }}>{t('editor.aiPanel.instrDone')}</Text>
        )}
      </div>
    </div>
  );
}
