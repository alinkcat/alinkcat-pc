import { Button, Space, Typography } from 'antd';
import { useAIStore } from '../../../../store/aiStore';
import type { AIMessage } from '../../../../types/ai';

const { Text, Paragraph } = Typography;

const ROLE_YOU = '\u4f60';
const ROLE_AI = 'AI';
const INSTR_DETECT = 'AI \u68c0\u6d4b\u5230';
const INSTR_COUNT = '\u6761\u5f85\u6267\u884c\u6307\u4ee4';
const BTN_CONFIRM = '\u786e\u8ba4\u6267\u884c';
const BTN_CANCEL = '\u53d6\u6d88';
const DONE = '\u2713 \u6307\u4ee4\u5df2\u6267\u884c';

export default function AIPanelMessageItem({ message }: { message: AIMessage }) {
  const { confirmInstruction, cancelInstruction } = useAIStore();
  const isUser = message.role === 'user';
  const pendingInstrs = (message.instructions || []).filter((i) => !i.confirmed && !i.canceled && !i.executed);
  const hasExecuted = (message.instructions || []).some((i) => i.executed && i.confirmed);

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
      <div className="ai-msg-role">{isUser ? ROLE_YOU : ROLE_AI}</div>
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
              {INSTR_DETECT} {pendingInstrs.length} {INSTR_COUNT}
            </Text>
            <Space size={4}>
              <Button size="small" type="primary"
                onClick={() => pendingInstrs.forEach((i) => confirmInstruction(message.id, i.id))}>
                {BTN_CONFIRM}
              </Button>
              <Button size="small"
                onClick={() => pendingInstrs.forEach((i) => cancelInstruction(message.id, i.id))}>
                {BTN_CANCEL}
              </Button>
            </Space>
          </div>
        )}

        {hasExecuted && (
          <Text style={{ fontSize: 11, color: '#52c41a', display: 'block', marginTop: 4 }}>{DONE}</Text>
        )}
      </div>
    </div>
  );
}
