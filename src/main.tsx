import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './i18n';
import { useI18nStore } from './i18n/useI18nStore';

Sentry.init({
  dsn: 'https://your-dsn@sentry.io/your-project',
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  environment: import.meta.env.MODE,
});

// 预加载语言状态（含 antd locale），避免首帧语言闪烁
useI18nStore.getState().hydrate().catch(console.error);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
