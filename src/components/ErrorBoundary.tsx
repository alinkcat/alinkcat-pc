import * as Sentry from '@sentry/react';
import { Button, Result, Space } from 'antd';
import { message } from '../utils/message';
import i18n from '../i18n/setup';
import { exportEncryptedLogs } from '../utils/errorExport';

function FallbackRender({ error, resetError }: { error: Error | null; resetError: () => void }) {
  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(error?.message || '');
      message.success(i18n.t('errorBoundary.copied') || 'Copied');
    } catch {
      message.error(i18n.t('errorBoundary.copyFailed') || 'Copy failed');
    }
  };

  const handleExportLogs = async () => {
    try {
      await exportEncryptedLogs();
      message.success(i18n.t('errorBoundary.exported') || 'Exported');
    } catch (err) {
      message.error((err as Error).message || 'Export failed');
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Result
        status="500"
        title={i18n.t('errorBoundary.title')}
        subTitle={error?.message || i18n.t('errorBoundary.unknownError')}
        extra={
          <Space direction="vertical" size="small">
            <Button type="primary" onClick={() => { resetError(); window.location.reload(); }}>
              {i18n.t('errorBoundary.refresh')}
            </Button>
            <Space>
              <Button onClick={handleCopyError}>
                {i18n.t('errorBoundary.copyError') || 'Copy Error'}
              </Button>
              <Button onClick={handleExportLogs}>
                {i18n.t('errorBoundary.exportLogs') || 'Export Logs'}
              </Button>
            </Space>
          </Space>
        }
      />
    </div>
  );
}

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={FallbackRender}>
      {children}
    </Sentry.ErrorBoundary>
  );
}