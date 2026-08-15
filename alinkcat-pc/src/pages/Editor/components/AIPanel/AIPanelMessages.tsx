import { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import { useAIStore } from '../../../../store/aiStore';
import AIPanelMessageItem from './AIPanelMessageItem';

export default function AIPanelMessages() {
  const messages = useAIStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="ai-messages ai-empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="试试输入：帮我添加一个 CPU 监控表盘" />
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
