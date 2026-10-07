import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './i18n';
import { useI18nStore } from './i18n/useI18nStore';

// only enable Sentry when a real DSN is configured
const SENTRY_DSN = 'https://your-dsn@sentry.io/your-project';
if (SENTRY_DSN && !SENTRY_DSN.includes('your-dsn')) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

// preload language state（including antd locale），prevent first-frame language flicker
useI18nStore.getState().hydrate().catch(console.error);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
