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
    // 流式逐 chunk 更新时用瞬时滚动（避免排队多个 smooth 动画导致的抖动）；
    // 消息定型/新增用平滑滚动。
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
