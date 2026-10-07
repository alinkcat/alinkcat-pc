import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { useAIStore } from '../../../../store/aiStore';
import AIPanelMessageItem from './AIPanelMessageItem';

export default function AIPanelMessages() {
  const { t } = useTranslation();
  const messages = useAIStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = messages.length > 0 && messages[messages.length - 1].status === 'streaming';

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    // instant scroll while streaming (queued smooth animations jitter);
    // smooth scroll once a message settles or a new one arrives.
    el.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="ai-messages ai-empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('editor.aiPanel.emptyHint')} />
      </div>
    );
  }

  return (
    <div className="ai-messages">
      {messages.map((m) => (
        <AIPanelMessageItem key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
