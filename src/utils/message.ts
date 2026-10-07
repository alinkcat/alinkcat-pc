import { message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

// central message proxy.
// antd static message.* renders on its own react root and can't consume the
// ConfigProvider context (dynamic theme), antd v6 spams deprecation/context warnings.
// MessageBinder mounts at the app root (inside <AntApp>) and binds the
// context-aware instance from App.useApp() here; code imports `message`
// from this module, keeping the message.success(...) call style without warnings.
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
