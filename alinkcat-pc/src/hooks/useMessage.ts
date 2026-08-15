import { App } from 'antd';

/** 获取 antd App 上下文中的 message（支持动态主题）。 */
export function useMessage() {
  return App.useApp();
}
