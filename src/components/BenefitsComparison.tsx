import { Modal, Tag, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { BenefitsComparison, LevelBenefits } from '../api/types';

const LEVELS = [
  { key: 'free' as const, label: '免费用户', color: '#999' },
  { key: 'level1' as const, label: '高级会员', color: '#faad14' },
  { key: 'level2' as const, label: '专业会员', color: '#722ed1' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function BoolIcon({ value }: { value: boolean }) {
  return value
    ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
    : <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 16 }} />;
}

interface RowDef {
  label: string;
  render: (l: LevelBenefits) => React.ReactNode;
}

const ROWS: RowDef[] = [
  { label: '云盘空间', render: (l) => l.cloudStorage.enabled ? formatBytes(l.cloudStorage.maxTotalBytes) : '-' },
  { label: '单文件上限', render: (l) => l.cloudStorage.enabled ? formatBytes(l.cloudStorage.maxFileSize) : '-' },
  { label: '最大文件数', render: (l) => l.cloudStorage.enabled ? `${l.cloudStorage.maxFiles} 个` : '-' },
  { label: 'AI 对话/月', render: (l) => `${l.aiChat} 次` },
  { label: '免广告', render: (l) => <BoolIcon value={l.noAds} /> },
  { label: '极速下载', render: (l) => <BoolIcon value={l.fastDownload} /> },
  { label: '自定义主题', render: (l) => <BoolIcon value={l.customTheme} /> },
  { label: '数据导出', render: (l) => <BoolIcon value={l.dataExport} /> },
  { label: '优先客服', render: (l) => <BoolIcon value={l.prioritySupport} /> },
  { label: '多设备同步', render: (l) => <BoolIcon value={l.multiDevice} /> },
];

interface Props {
  data: BenefitsComparison | null;
}

export default function BenefitsComparison({ data }: Props) {
  const [open, setOpen] = useState(false);

  if (!data) {
    return <Button type="link" disabled>权益对比</Button>;
  }

  const levels = data.defaultBenefits;

  return (
    <>
      <Button type="link" onClick={() => setOpen(true)} style={{ padding: 0 }}>
        查看权益对比
      </Button>
      <Modal
        title="会员权益对比"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={680}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '2px solid #f0f0f0', fontWeight: 600, minWidth: 120 }}>功能</th>
                {LEVELS.map((l) => (
                  <th key={l.key} style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '2px solid #f0f0f0', minWidth: 110 }}>
                    <Tag color={l.color} style={{ fontSize: 13, padding: '2px 10px' }}>{l.label}</Tag>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', color: '#555' }}>{row.label}</td>
                  {LEVELS.map((l) => (
                    <td key={l.key} style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                      {row.render(levels[l.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#999', textAlign: 'center' }}>
          {data.plans.filter(p => p.status === 1).map(p => `${p.name} ¥${p.price}/${p.durationDays}天`).join(' · ')}
        </div>
      </Modal>
    </>
  );
}