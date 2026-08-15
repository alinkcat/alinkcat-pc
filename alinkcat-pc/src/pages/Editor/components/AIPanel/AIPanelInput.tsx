import { useTranslation } from 'react-i18next';
import { useState, useRef, useCallback } from 'react';
import { Tooltip } from 'antd';
import { SendOutlined, PlusOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAIStore } from '../../../../store/aiStore';

export default function AIPanelInput() {
  const { t } = useTranslation();
  const { sendMessage, sending, droppedImages, removeDroppedImage } = useAIStore();
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  }, []);

  const handleSend = () => {
    const content = text.trim();
    if ((!content && droppedImages.length === 0) || sending) return;
    let final = content;
    if (droppedImages.length > 0) {
      const refs = droppedImages.map((d) => `[图片:${d.name}]`).join(' ');
      final = content ? `${content}\n\n已上传图片：${refs}` : `已上传图片：${refs}`;
    }
    sendMessage(final);
    setText('');
  };

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const readers = files.map((f) => {
      return new Promise<{ name: string; dataUrl: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: f.name, dataUrl: reader.result as string });
        reader.readAsDataURL(f);
      });
    });
    Promise.all(readers).then((results) => {
      useAIStore.getState().addDroppedImages(results);
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div
      className="ai-input"
      style={{
        background: dragOver ? 'rgba(79,110,247,0.06)' : undefined,
      }}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      {/* 已上传图片预览（大图） */}
      {droppedImages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {droppedImages.map((img) => (
            <Tooltip key={img.name} title={`${img.name} - ${img.fileName}`}>
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(79,110,247,0.3)' }}
                />
                <span
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                    background: '#ff4d4f', borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                  onClick={() => removeDroppedImage(img.name)}
                >
                  <CloseCircleOutlined style={{ fontSize: 12, color: '#fff' }} />
                </span>
                <span
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9,
                    textAlign: 'center', padding: '1px 0', borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
                  }}
                >
                  {img.name}
                </span>
              </span>
            </Tooltip>
          ))}
        </div>
      )}

      {/* 输入框 + 操作按钮 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: '1px solid #d9d9d9', borderRadius: 10, padding: '4px 6px', background: 'var(--ai-input-bg, #fff)' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            width: 28, height: 28, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#4F6EF7', flexShrink: 0,
          }}
          title={t('editor.aiPanel.uploadTooltip')}
        >
          <PlusOutlined />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t('editor.aiPanel.inputPlaceholder')}
          rows={1}
          style={{
            flex: 1, border: 'none', outline: 'none', resize: 'none',
            background: 'transparent', fontSize: 13, lineHeight: '20px',
            padding: '4px 0', color: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && droppedImages.length === 0) || sending}
          style={{
            border: 'none', cursor: sending ? 'default' : 'pointer',
            width: 28, height: 28, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: (!text.trim() && droppedImages.length === 0) || sending ? '#d9d9d9' : '#4F6EF7',
            color: '#fff',
          }}
          title={t('editor.aiPanel.send')}
        >
          <SendOutlined style={{ fontSize: 13 }} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFilePick}
      />
    </div>
  );
}