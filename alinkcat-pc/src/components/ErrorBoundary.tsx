import * as Sentry from '@sentry/react';
import { Button, Result } from 'antd';
import i18n from '../i18n/setup';

function FallbackRender({ error, resetError }: { error: Error | null; resetError: () => void }) {
  return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Result
        status="500"
        title={i18n.t('errorBoundary.title')}
        subTitle={error?.message || i18n.t('errorBoundary.unknownError')}
        extra={
          <Button type="primary" onClick={() => { resetError(); window.location.reload(); }}>
            {i18n.t('errorBoundary.refresh')}
          </Button>
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