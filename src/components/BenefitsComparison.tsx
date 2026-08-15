import { Modal, Tag, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { BenefitsComparison, LevelBenefits } from '../api/types';

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

interface Props {
  data: BenefitsComparison | null;
}

export default function BenefitsComparison({ data }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const LEVELS = [
    { key: 'free' as const, label: t('member.benefitsFree'), color: '#999' },
    { key: 'level1' as const, label: t('member.benefitsPremium'), color: '#faad14' },
    { key: 'level2' as const, label: t('member.benefitsPro'), color: '#722ed1' },
  ];

  const ROWS: RowDef[] = [
    { label: t('member.benefitsCloudSpace'), render: (l) => l.cloudStorage.enabled ? formatBytes(l.cloudStorage.maxTotalBytes) : '-' },
    { label: t('member.benefitsFileLimit'), render: (l) => l.cloudStorage.enabled ? formatBytes(l.cloudStorage.maxFileSize) : '-' },
    { label: t('member.benefitsMaxFiles'), render: (l) => l.cloudStorage.enabled ? t('member.benefitsCount', { count: l.cloudStorage.maxFiles }) : '-' },
    { label: t('member.benefitsAIChats'), render: (l) => t('member.benefitsTimes', { count: l.aiChat }) },
    { label: t('member.benefitsNoAds'), render: (l) => <BoolIcon value={l.noAds} /> },
    { label: t('member.benefitsFastDownload'), render: (l) => <BoolIcon value={l.fastDownload} /> },
    { label: t('member.benefitsCustomTheme'), render: (l) => <BoolIcon value={l.customTheme} /> },
    { label: t('member.benefitsDataExport'), render: (l) => <BoolIcon value={l.dataExport} /> },
    { label: t('member.benefitsPrioritySupport'), render: (l) => <BoolIcon value={l.prioritySupport} /> },
    { label: t('member.benefitsMultiDevice'), render: (l) => <BoolIcon value={l.multiDevice} /> },
  ];

  if (!data) {
    return <Button type="link" disabled>{t('member.benefitsComparison')}</Button>;
  }

  const levels = data.defaultBenefits;

  return (
    <>
      <Button type="link" onClick={() => setOpen(true)} style={{ padding: 0 }}>
        {t('member.benefitsComparison')}
      </Button>
      <Modal
        title={t('member.benefitsTitle')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={680}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '2px solid #f0f0f0', fontWeight: 600, minWidth: 120 }}>{t('member.benefitsFeature')}</th>
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
          {data.plans.filter(p => p.status === 1).map(p => `${p.name} ¥${p.price}/${t('member.days', { days: p.durationDays })}`).join(' · ')}
        </div>
      </Modal>
    </>
  );
}