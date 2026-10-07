import { useEffect } from 'react';
import { App } from 'antd';
import { bindMessage } from './message';

/**
 * mount once inside <AntApp> at the app root to bind the context-aware message
 * instance into utils/message, so message.* works everywhere without warnings.
 */
export default function MessageBinder() {
  const { message } = App.useApp();
  useEffect(() => {
    bindMessage(message);
  }, [message]);
  return null;
}
