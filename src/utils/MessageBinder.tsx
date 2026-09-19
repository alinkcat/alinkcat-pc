import { useEffect } from 'react';
import { App } from 'antd';
import { bindMessage } from './message';

/**
 * mount this component at the app root (inside <AntApp>), taking the context-aware message instance
 * bound to the utils/message module，for warning-free use across the project message.*。
 */
export default function MessageBinder() {
  const { message } = App.useApp();
  useEffect(() => {
    bindMessage(message);
  }, [message]);
  return null;
}
