import { useEffect } from 'react';
import { Flex, Tooltip } from 'antd';
import { useServerStatusStore } from '../../store/serverStatusStore';

export default function AppFooter() {
  const { running, port, deviceCount, fetchStatus } = useServerStatusStore();

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="app-footer">
      <Flex align="center" gap={16} style={{ minWidth: 0 }}>
        <span className="footer-status">
          <span className={`footer-status-dot ${running ? 'footer-status-dot--active' : 'stopped'}`} />
          {running ? '服务运行中' : '服务已停止'}
        </span>
        <Tooltip title={`监听端口：${port}`}>
          <span className="footer-item">端口：{port}</span>
        </Tooltip>
      </Flex>
      <Flex align="center" gap={16} style={{ flexShrink: 0 }}>
        <Tooltip title={`已连接设备：${deviceCount} 台`}>
          <span className="footer-item">设备：{deviceCount} 台</span>
        </Tooltip>
      </Flex>
    </footer>
  );
}