import { useState, useEffect, useCallback } from 'react';
import { tauriInvoke } from '../utils/tauri';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Table, Button, Tag, Space, Card, Typography, Spin, message, Empty, Row, Col, Select,
} from 'antd';
import {
  PlayCircleOutlined, StopOutlined, ReloadOutlined, DesktopOutlined, CopyOutlined,
  CheckOutlined, ToolOutlined, CloudServerOutlined, LinkOutlined,
  MobileOutlined, QrcodeOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { deviceApi } from '../api/deviceApi';
import { useServerStatusStore } from '../store/serverStatusStore';
import type { ClientInfo, ServerStatus, ConnectionLog } from '../types/theme';
import type { UserDevice } from '../api/types';

const { Text } = Typography;

export default function Devices() {
  const [connections, setConnections] = useState<ClientInfo[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [localIps, setLocalIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [qrValue, setQrValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [infoCopied, setInfoCopied] = useState(false);
  const { isLoggedIn } = useAuthStore();
  const [cloudDevices, setCloudDevices] = useState<UserDevice[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  const { running: serverRunning, port, fetchStatus, setRunning } = useServerStatusStore();

  const loadDeviceData = useCallback(async () => {
    await fetchStatus();
    try {
      const st = await tauriInvoke<ServerStatus>('get_server_status');
      setPairingCode(st.running ? await tauriInvoke<string>('get_pairing_code') : null);
    } catch { /* ignore */ }
    try {
      setLogs(await tauriInvoke<ConnectionLog[]>('get_connection_logs'));
    } catch { /* ignore */ }
  }, [fetchStatus]);

  const fetchConnections = useCallback(async () => {
    try {
      setConnections(await tauriInvoke<ClientInfo[]>('get_connections'));
    } catch {
      /* ignore */
    }
  }, []);

  const fetchLocalIp = useCallback(async () => {
    try {
      const ips = await tauriInvoke<string[]>('get_local_ip');
      setLocalIps(ips);
      setSelectedIp((prev) => (ips.includes(prev) ? prev : (ips[0] ?? '')));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (serverRunning && selectedIp && pairingCode) {
      setQrValue(`alinkcat://connect?ip=${selectedIp}&port=${port}&pair=${pairingCode}`);
    } else {
      setQrValue('');
    }
  }, [serverRunning, selectedIp, pairingCode, port]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadDeviceData(), fetchConnections(), fetchLocalIp()]);
      setLoading(false);
    };
    init();
  }, [loadDeviceData, fetchConnections, fetchLocalIp]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadDeviceData();
      fetchConnections();
    }, 3000);
    return () => clearInterval(timer);
  }, [loadDeviceData, fetchConnections]);

  const fetchCloudDevices = useCallback(async () => {
    if (!isLoggedIn) return;
    setCloudLoading(true);
    try {
      const resp = await deviceApi.my({ page: 1, size: 50 });
      if (resp.code === 200 && resp.data) setCloudDevices(resp.data.records);
    } catch { /* ignore */ }
    finally { setCloudLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) fetchCloudDevices();
  }, [isLoggedIn, fetchCloudDevices]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const code = await tauriInvoke<string>('start_server');
      setPairingCode(code);
      setRunning(true);
      await loadDeviceData();
      message.success('服务已启动');
    } catch (e) {
      message.error(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await tauriInvoke('stop_server');
      setPairingCode(null);
      setConnections([]);
      setRunning(false);
      await loadDeviceData();
      message.success('服务已停止');
    } catch (e) {
      message.error(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshCode = async () => {
    setActionLoading(true);
    try {
      const code = await tauriInvoke<string>('regenerate_pairing_code');
      setPairingCode(code);
      setCodeCopied(false);
      message.success('配对码已刷新');
    } catch (e) {
      message.error(String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const copyText = async (text: string, onDone: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
      setTimeout(() => onDone(), 1500);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const columns = [
    {
      title: '设备名称',
      dataIndex: 'device_name',
      key: 'device_name',
      render: (name: string) => name || <Text type="secondary">未命名设备</Text>,
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
    },
    {
      title: '应用版本',
      dataIndex: 'app_version',
      key: 'app_version',
      render: (v: string) => v || '-',
    },
    {
      title: '连接时间',
      dataIndex: 'connected_at',
      key: 'connected_at',
      render: (t: string) => new Date(t).toLocaleString(),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">设备管理</h1>
        <p className="page-subtitle">查看和管理已连接的设备</p>
      </div>

      <div className="device-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span className={`footer-status-dot ${serverRunning ? '' : 'stopped'}`} />
          <Text strong>{serverRunning ? '服务运行中' : '服务已停止'}</Text>
          {serverRunning && <Tag color="success">端口 {port}</Tag>}
          {!serverRunning && <Tag>端口 {port}</Tag>}
        </div>

        <Space>
          {serverRunning ? (
            <>
              <Button
                icon={<ReloadOutlined />}
                loading={actionLoading}
                onClick={handleRefreshCode}
              >
                刷新配对码
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={actionLoading}
                onClick={handleStop}
              >
                停止服务
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={actionLoading}
              onClick={handleStart}
            >
              启动服务
            </Button>
          )}
        </Space>
      </div>

      {serverRunning && pairingCode && (
        <Card
          style={{ marginBottom: 16, textAlign: 'center' }}
          styles={{ body: { padding: '24px' } }}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            手机端连接配对码
          </Text>
          <div className="pairing-code">{pairingCode}</div>
          <Space style={{ marginTop: 12 }}>
            <Button
              size="small"
              icon={codeCopied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={() => copyText(pairingCode, () => setCodeCopied(true))}
            >
              {codeCopied ? '已复制' : '复制配对码'}
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={actionLoading}
              onClick={handleRefreshCode}
            >
              刷新
            </Button>
          </Space>
        </Card>
      )}

      <Card
        title={
          <span>
            <QrcodeOutlined style={{ marginRight: 8 }} />
            连接二维码
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        {!serverRunning ? (
          <Empty description="请先启动服务，二维码将自动生成" style={{ padding: '24px 0' }} />
        ) : localIps.length === 0 ? (
          <Empty description="未检测到网络连接，请检查网络设置" style={{ padding: '24px 0' }} />
        ) : (
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: 10,
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                }}
              >
                <QRCodeCanvas value={qrValue || 'alinkcat://connect'} size={180} level="M" />
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  请使用手机 App 扫码自动连接
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={16}>
              <Space orientation="vertical" size={8}>
                <Text strong>连接信息</Text>
                {localIps.length > 1 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>选择 IP 地址：</Text>
                    <Select
                      size="small"
                      value={selectedIp}
                      onChange={setSelectedIp}
                      style={{ width: 180, marginLeft: 8 }}
                      options={localIps.map((ip) => ({ label: ip, value: ip }))}
                    />
                  </div>
                )}
                <Text style={{ fontSize: 13 }}>IP: {selectedIp}</Text>
                <Text style={{ fontSize: 13 }}>端口: {port}</Text>
                <Text style={{ fontSize: 13 }}>配对码: {pairingCode}</Text>
                <Button
                  size="small"
                  icon={infoCopied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={() =>
                    copyText(
                      `IP: ${selectedIp}\n端口: ${port}\n配对码: ${pairingCode}\n连接: alinkcat://connect?ip=${selectedIp}&port=${port}&pair=${pairingCode}`,
                      () => setInfoCopied(true),
                    )
                  }
                >
                  {infoCopied ? '已复制' : '复制全部'}
                </Button>
              </Space>
            </Col>
          </Row>
        )}
      </Card>


      <Card
        title={
          <span>
            <ToolOutlined style={{ marginRight: 8 }} />
            连接诊断
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={8} md={4}>
            <div className="diag-stat-label">服务状态</div>
            <div className="diag-stat-value">
              {serverRunning ? (
                <span style={{ color: '#52c41a' }}>
                  <CloudServerOutlined /> 运行中
                </span>
              ) : (
                <span style={{ color: '#999' }}>已停止</span>
              )}
            </div>
          </Col>
          <Col xs={8} md={4}>
            <div className="diag-stat-label">监听端口</div>
            <div className="diag-stat-value">{port}</div>
          </Col>
          <Col xs={8} md={4}>
            <div className="diag-stat-label">已连接设备</div>
            <div className="diag-stat-value">{connections.length}</div>
          </Col>
          <Col xs={24} md={12}>
            <div className="diag-stat-label">手机端连接地址</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="diag-stat-value">
                {selectedIp ? `ws://${selectedIp}:${port}` : '—'}
              </span>
              <Button
                size="small"
                icon={infoCopied ? <CheckOutlined /> : <LinkOutlined />}
                disabled={!selectedIp}
                onClick={() =>
                  copyText(`ws://${selectedIp}:${port}`, () => setInfoCopied(true))
                }
              >
                {infoCopied ? '已复制' : '复制连接信息'}
              </Button>
            </div>
            {!serverRunning && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                服务未启动。Windows 首次启动请允许防火墙授权，否则手机将无法连接。
              </Text>
            )}
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <span>
            <DesktopOutlined style={{ marginRight: 8 }} />
            已连接设备 ({connections.length})
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : (
          <Table
            dataSource={connections}
            columns={columns}
            rowKey="client_id"
            locale={{ emptyText: '暂无设备连接' }}
            pagination={false}
            size="middle"
          />
        )}
      </Card>

      <Card
        title={
          <span>
            <CloudServerOutlined style={{ marginRight: 8 }} />
            连接日志（最近 {logs.length} 条）
          </span>
        }
      >
        {logs.length === 0 ? (
          <Empty description="暂无连接日志" />
        ) : (
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {logs.map((item) => (
              <div key={item.time} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 150 }}>
                  {new Date(item.time).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 13 }}>{item.message}</Text>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isLoggedIn && (
        <Card
          title={
            <span>
              <MobileOutlined style={{ marginRight: 8 }} />
              已登录设备
            </span>
          }
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchCloudDevices}>刷新</Button>}
          style={{ marginTop: 16 }}
        >
          {cloudLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : cloudDevices.length === 0 ? (
            <Empty description="暂无已登录设备记录" />
          ) : (
            <Table
              dataSource={cloudDevices}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: '设备名称', dataIndex: 'deviceName', render: (v: string) => v || '未知设备' },
                { title: '类型', dataIndex: 'deviceType', width: 80, render: (v: string) => <Tag>{v || '-'}</Tag> },
                { title: '系统版本', dataIndex: 'osVersion', width: 150, ellipsis: true },
                { title: 'IP 地址', dataIndex: 'ipAddress', width: 140 },
                { title: '登录次数', dataIndex: 'loginCount', width: 80 },
                { title: '最后登录', dataIndex: 'lastLoginAt', width: 170, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
