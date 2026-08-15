import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n';
import { useI18nStore } from './i18n/useI18nStore';

// 预加载语言状态（含 antd locale），避免首帧语言闪烁
useI18nStore.getState().hydrate().catch(console.error);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
