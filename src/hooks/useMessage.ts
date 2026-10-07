import { App } from 'antd';

/** get the message from antd App context (supports dynamic themes)。 */
export function useMessage() {
  return App.useApp();
}
