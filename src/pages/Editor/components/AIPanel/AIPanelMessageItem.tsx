import { useTranslation } from 'react-i18next';
import { Alert, Button, Space, Typography } from 'antd';
import { useAIStore } from '../../../../store/aiStore';
import type { AIMessage, AIInstruction } from '../../../../types/ai';
import { instrTypeKey } from '../../../../hooks/useAICommands';

const { Text, Paragraph } = Typography;

/** split AI reply by ```json fence into [text, JSON, text, ...]，JSON segments collapse by default。
 *  when streaming=true, JSON renders in an expanded <pre>（no collapsing），during streaming to avoid
 *  <details> jitter from repeated rebuilds resetting the collapse state。 */
function renderContent(content: string, t: (key: string, opts?: Record<string, unknown>) => string, streaming: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /```json\s*([\s\S]*?)```/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const preStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.04)', border: '1px solid #eee', borderRadius: 6,
    padding: 8, marginTop: 6, maxHeight: 240, overflow: 'auto',
    fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  };
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={key++}>{content.slice(lastIndex, m.index)}</span>);
    }
    const jsonText = m[1].trim();
    if (streaming) {
      // during streaming: show expanded directly，avoid jitter from block rebuilds
      parts.push(<pre key={key++} style={preStyle}>{jsonText}</pre>);
    } else {
      parts.push(
        <details key={key++} style={{ margin: '6px 0', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#888', userSelect: 'none' }}>
            {t('editor.aiPanel.jsonCollapsed', { count: jsonText.length })}
          </summary>
          <pre style={preStyle}>{jsonText}</pre>
        </details>,
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={key++}>{content.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : [content];
}

/** generate a human-readable target summary for an instruction (e.g. "CPU monitor", "page 0", "theme cyberpunk") */
function describeTarget(instr: AIInstruction): string {
  const w = instr.widget as Record<string, unknown> | undefined;
  const p = instr.params as Record<string, unknown> | undefined;
  const th = instr.theme as Record<string, unknown> | undefined;
  switch (instr.type) {
    case 'add_widget': {
      const label = String(w?.label || w?.type || '');
      return instr.pageIndex !== undefined ? `Page ${instr.pageIndex} · ${label}` : label;
    }
    case 'delete_widget':
    case 'update_widget':
    case 'duplicate_widget':
    case 'move_widget':
    case 'resize_widget': {
      const id = String(p?.widgetId || p?.label || '');
      return instr.pageIndex !== undefined && instr.type === 'delete_widget' ? `Page ${instr.pageIndex} · ${id}` : id;
    }
    case 'add_page':
      return String(p?.label || '');
    case 'delete_page':
    case 'change_layout':
    case 'set_background': {
      const idx = instr.pageIndex ?? p?.pageIndex;
      return idx !== undefined ? `Page ${idx}` : '';
    }
    case 'reorder_pages':
      return `${String(p?.oldIndex ?? '')} → ${String(p?.newIndex ?? '')}`;
    case 'set_orientation':
      return String(p?.orientation || '');
    case 'set_theme_meta':
      return String(p?.name || '');
    case 'batch':
      return `${Array.isArray(p?.actions) ? (p!.actions as unknown[]).length : 0}  sub-actions`;
    case 'generate_full_theme': {
      const name = String(th?.name || '');
      const pages = Array.isArray(th?.pages) ? (th!.pages as unknown[]).length : 0;
      return `${name}（${pages}）`;
    }
    default:
      return '';
  }
}

/** single instruction: type + target summary + status + action buttons */
function InstructionRow({ messageId, instr }: { messageId: string; instr: AIInstruction }) {
  const { t } = useTranslation();
  const { confirmInstruction, cancelInstruction } = useAIStore();
  const target = describeTarget(instr);
  const isPending = !instr.confirmed && !instr.canceled && !instr.executed;
  const isFailed = instr.executed && instr.failed;

  return (
    <div className="ai-instr-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: instr.severity === 'danger' ? '#fa541c' : '#4F6EF7' }}>
            {t(instrTypeKey(instr.type))}
          </Text>
          {instr.severity === 'danger' && (
            <Text style={{ fontSize: 10, color: '#fa541c', border: '1px solid #ffa39e', borderRadius: 4, padding: '0 4px' }}>
              ⚠️ overwrite
            </Text>
          )}
          {target && <Text style={{ fontSize: 12, color: '#666' }}>· {target}</Text>}
        </div>
        {isFailed && instr.error && (
          <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
            {t('editor.aiPanel.instrFailedReason', { reason: instr.error })}
          </Text>
        )}
      </div>
      {isPending && (
        <Space size={4}>
          <Button size="small" type={instr.severity === 'danger' ? 'primary' : 'default'}
            danger={instr.severity === 'danger'}
            onClick={() => confirmInstruction(messageId, instr.id)}>
            {instr.severity === 'danger' ? t('editor.aiPanel.btnConfirmDanger') : t('editor.aiPanel.btnConfirm')}
          </Button>
          <Button size="small" onClick={() => cancelInstruction(messageId, instr.id)}>
            {t('editor.aiPanel.btnCancel')}
          </Button>
        </Space>
      )}
      {!isPending && !isFailed && instr.executed && (
        <Text style={{ fontSize: 12, color: '#52c41a', flexShrink: 0 }}>✓ {t('editor.aiPanel.instrDone')}</Text>
      )}
      {instr.canceled && (
        <Text style={{ fontSize: 12, color: '#999', flexShrink: 0 }}>✕ {t('editor.aiPanel.btnCancel')}</Text>
      )}
    </div>
  );
}

export default function AIPanelMessageItem({ message }: { message: AIMessage }) {
  const { t } = useTranslation();
  const { confirmInstruction, cancelInstruction } = useAIStore();
  const isUser = message.role === 'user';
  const instrs = message.instructions || [];
  const pendingInstrs = instrs.filter((i) => !i.confirmed && !i.canceled && !i.executed);
  const failedInstrs = instrs.filter((i) => i.executed && i.failed);
  const doneCount = instrs.filter((i) => i.executed && !i.failed).length;
  const hasDanger = pendingInstrs.some((i) => i.severity === 'danger');

  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
      <div className="ai-msg-role">{isUser ? t('editor.aiPanel.roleYou') : t('editor.aiPanel.roleAI')}</div>
      <div className="ai-msg-content">
        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content ? renderContent(message.content, t, message.status === 'streaming') : (message.status === 'streaming' ? '\u2026' : '')}
        </Paragraph>

        {message.status === 'error' && (
          <Text type="danger" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{message.content}</Text>
        )}

        {instrs.length > 0 && (
          <div className="ai-instr-confirm" style={{ marginTop: 8 }}>
            {hasDanger && (
              <Alert
                type="warning"
                showIcon
                message={t('editor.aiPanel.instrDangerTitle')}
                description={t('editor.aiPanel.instrDangerDesc')}
                style={{ marginBottom: 8 }}
              />
            )}
            <Text style={{ fontSize: 12, color: '#888' }}>
              📋 {t('editor.aiPanel.instrDetected')} {instrs.length} {t('editor.aiPanel.instrCount')}
            </Text>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {instrs.map((i) => (
                <InstructionRow key={i.id} messageId={message.id} instr={i} />
              ))}
            </div>
            {pendingInstrs.length > 1 && (
              <Space size={4} style={{ marginTop: 8 }}>
                <Button size="small" type="primary" danger={hasDanger}
                  onClick={() => pendingInstrs.forEach((i) => confirmInstruction(message.id, i.id))}>
                  {t('editor.aiPanel.instrAllConfirm')} ({pendingInstrs.length})
                </Button>
                <Button size="small"
                  onClick={() => pendingInstrs.forEach((i) => cancelInstruction(message.id, i.id))}>
                  {t('editor.aiPanel.instrAllCancel')}
                </Button>
              </Space>
            )}
            {doneCount > 0 && (
              <Text style={{ fontSize: 11, color: '#52c41a', display: 'block', marginTop: 6 }}>
                ✓ {doneCount} {t('editor.aiPanel.instrDone')}
              </Text>
            )}
            {failedInstrs.length > 0 && (
              <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                ✗ {failedInstrs.length} {t('editor.aiPanel.instrFailed')}
              </Text>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
