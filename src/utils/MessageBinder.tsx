import { useEffect } from 'react';
import { App } from 'antd';
import { bindMessage } from './message';

/**
 * 在应用根部（<AntApp> 内）挂载此组件，把上下文感知的 message 实例
 * 绑定到 utils/message 模块，供全项目无警告地使用 message.*。
 */
export default function MessageBinder() {
  const { message } = App.useApp();
  useEffect(() => {
    bindMessage(message);
  }, [message]);
  return null;
}
