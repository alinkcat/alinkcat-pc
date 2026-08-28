import { message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

/**
 * 集中式 message 代理。
 *
 * antd 的静态 `message.*` 调用渲染在独立的 React 根上，无法消费 ConfigProvider
 * 上下文（如动态主题），antd v6 会打印废弃/上下文警告。
 * 解决方式：在 App 根部（<AntApp> 内）挂载 MessageBinder，它通过 App.useApp()
 * 取得上下文感知的 message 实例并绑定到这里；业务代码统一从本模块导入 `message`，
 * 从而既保留原有 `message.success(...)` 调用风格，又不再触发警告。
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
