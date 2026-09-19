import { message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

/**
 * centralized message proxy。
 *
 * antd static `message.*` renders on a separate React root，cannot access ConfigProvider
 * context（e.g. dynamic theme），antd v6 prints deprecation/context warnings。
 * solution：at the App root（<AntApp> inside）mount MessageBinder，it uses App.useApp()
 * gets a context-aware message instance and binds it here；business code imports uniformly from this module `message`，
 * thus keeping the original `message.success(...)` call style，without triggering warnings。
 */
let ctxMessage: MessageInstance | null = null;

export function bindMessage(instance: MessageInstance) {
  ctxMessage = instance;
}

function current(): MessageInstance {
  return ctxMessage ?? staticMessage;
}

export const message: MessageInstance = {
  success: (content, duration, onClose) => current().success(content, duration, onClose),
  error: (content, duration, onClose) => current().error(content, duration, onClose),
  warning: (content, duration, onClose) => current().warning(content, duration, onClose),
  info: (content, duration, onClose) => current().info(content, duration, onClose),
  loading: (content, duration, onClose) => current().loading(content, duration, onClose),
  open: (args) => current().open(args),
  destroy: (key) => current().destroy(key),
};

export default message;
