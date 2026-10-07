import { App } from 'antd';

/** message instance from the antd App context (theme-aware) */
export function useMessage() {
  return App.useApp();
}
