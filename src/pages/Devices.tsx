import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { tauriInvoke } from '../utils/tauri';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Table, Button, Tag, Space, Card, Typography, Spin, Empty, Row, Col, Select,
} from 'antd';
import { message } from '../utils/message';
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
  const { t } = useTranslation();
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

  // in-page polling follows settings（status_polling toggle + frequency），only load once when disabled
  useEffect(() => {
    let settings: { status_polling?: boolean; status_polling_interval?: number } = {};
    try {
      const raw = localStorage.getItem('ilinkcat_settings');
      if (raw) settings = JSON.parse(raw);
    } catch { /* ignore */ }
    if (!settings.status_polling) return;
    const intervalMs = Math.max(1, settings.status_polling_interval || 3) * 1000;
    const timer = setInterval(() => {
      loadDeviceData();
      fetchConnections();
    }, intervalMs);
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
      message.success(t('devices.serviceStarted'));
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
      message.success(t('devices.serviceStoppedMsg'));
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
      message.success(t('devices.pairingCodeRefreshed'));
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
      message.error(t('devices.copyFailed'));
    }
  };

  const columns = [
    {
      title: t('devices.deviceName'),
      dataIndex: 'device_name',
      key: 'device_name',
      render: (name: string) => name || <Text type="secondary">{t('devices.unnamedDevice')}</Text>,
    },
    {
      title: t('devices.ipAddress'),
      dataIndex: 'ip_address',
      key: 'ip_address',
    },
    {
      title: t('devices.appVersion'),
      dataIndex: 'app_version',
      key: 'app_version',
      render: (v: string) => v || '-',
    },
    {
      title: t('devices.connectionTime'),
      dataIndex: 'connected_at',
      key: 'connected_at',
      render: (t: string) => new Date(t).toLocaleString(),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('devices.deviceManagement')}</h1>
        <p className="page-subtitle">{t('devices.deviceManagementDesc')}</p>
      </div>

      <div className="device-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <span className={`footer-status-dot ${serverRunning ? '' : 'stopped'}`} />
          <Text strong>{serverRunning ? t('devices.serviceRunning') : t('devices.serviceStopped')}</Text>
          {serverRunning && <Tag color="success">{t('devices.port')} {port}</Tag>}
          {!serverRunning && <Tag>{t('devices.port')} {port}</Tag>}
        </div>

        <Space>
          {serverRunning ? (
            <>
              <Button
                icon={<ReloadOutlined />}
                loading={actionLoading}
                onClick={handleRefreshCode}
              >
                {t('devices.refreshPairingCode')}
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={actionLoading}
                onClick={handleStop}
              >
                {t('devices.stopService')}
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={actionLoading}
              onClick={handleStart}
            >
              {t('devices.startService')}
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
            {t('devices.mobilePairingCode')}
          </Text>
          <div className="pairing-code">{pairingCode}</div>
          <Space style={{ marginTop: 12 }}>
            <Button
              size="small"
              icon={codeCopied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={() => copyText(pairingCode, () => setCodeCopied(true))}
            >
              {codeCopied ? t('devices.copied') : t('devices.copyPairingCode')}
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={actionLoading}
              onClick={handleRefreshCode}
            >
              {t('devices.refresh')}
            </Button>
          </Space>
        </Card>
      )}

      <Card
        title={
          <span>
            <QrcodeOutlined style={{ marginRight: 8 }} />
            {t('devices.connectionQRCode')}
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        {!serverRunning ? (
          <Empty description={t('devices.qrCodeEmptyDesc')} style={{ padding: '24px 0' }} />
        ) : localIps.length === 0 ? (
          <Empty description={t('devices.noNetworkDesc')} style={{ padding: '24px 0' }} />
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
                  {t('devices.scanWithApp')}
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={16}>
              <Space orientation="vertical" size={8}>
                <Text strong>{t('devices.connectionInfo')}</Text>
                {localIps.length > 1 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('devices.selectIp')}</Text>
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
                <Text style={{ fontSize: 13 }}>{t('devices.port')}: {port}</Text>
                <Text style={{ fontSize: 13 }}>{t('devices.pairingCode')}: {pairingCode}</Text>
                <Button
                  size="small"
                  icon={infoCopied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={() =>
                    copyText(
                      `IP: ${selectedIp}\n${t('devices.port')}: ${port}\n${t('devices.pairingCode')}: ${pairingCode}\n${t('devices.connectionLabel')}: alinkcat://connect?ip=${selectedIp}&port=${port}&pair=${pairingCode}`,
                      () => setInfoCopied(true),
                    )
                  }
                >
                  {infoCopied ? t('devices.copied') : t('devices.copyAll')}
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
            {t('devices.connectionDiagnosis')}
          </span>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={8} md={4}>
            <div className="diag-stat-label">{t('devices.serviceStatus')}</div>
            <div className="diag-stat-value">
              {serverRunning ? (
                <span style={{ color: '#52c41a' }}>
                  <CloudServerOutlined /> {t('devices.running')}
                </span>
              ) : (
                <span style={{ color: '#999' }}>{t('devices.stopped')}</span>
              )}
            </div>
          </Col>
          <Col xs={8} md={4}>
            <div className="diag-stat-label">{t('devices.listeningPort')}</div>
            <div className="diag-stat-value">{port}</div>
          </Col>
          <Col xs={8} md={4}>
            <div className="diag-stat-label">{t('devices.connectedDevices')}</div>
            <div className="diag-stat-value">{connections.length}</div>
          </Col>
          <Col xs={24} md={12}>
            <div className="diag-stat-label">{t('devices.mobileConnectionAddress')}</div>
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
                {infoCopied ? t('devices.copied') : t('devices.copyConnectionInfo')}
              </Button>
            </div>
            {!serverRunning && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('devices.firewallTip')}
              </Text>
            )}
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <span>
            <DesktopOutlined style={{ marginRight: 8 }} />
            {t('devices.connectedDevicesTitle')} ({connections.length})
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
            locale={{ emptyText: t('devices.noDevicesConnected') }}
            pagination={false}
            size="middle"
          />
        )}
      </Card>

      <Card
        title={
          <span>
            <CloudServerOutlined style={{ marginRight: 8 }} />
            {t('devices.connectionLogsTitle', { count: logs.length })}
          </span>
        }
      >
        {logs.length === 0 ? (
          <Empty description={t('devices.noConnectionLogs')} />
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
              {t('devices.cloudDevices')}
            </span>
          }
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchCloudDevices}>{t('common.refresh')}</Button>}
          style={{ marginTop: 16 }}
        >
          {cloudLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : cloudDevices.length === 0 ? (
            <Empty description={t('devices.noCloudDevices')} />
          ) : (
            <Table
              dataSource={cloudDevices}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t('devices.deviceName'), dataIndex: 'deviceName', render: (v: string) => v || t('devices.unknownDevice') },
                { title: t('devices.deviceType'), dataIndex: 'deviceType', width: 80, render: (v: string) => <Tag>{v || '-'}</Tag> },
                { title: t('devices.osVersion'), dataIndex: 'osVersion', width: 150, ellipsis: true },
                { title: t('devices.ipAddress'), dataIndex: 'ipAddress', width: 140 },
                { title: t('devices.loginCount'), dataIndex: 'loginCount', width: 80 },
                { title: t('devices.lastLogin'), dataIndex: 'lastLoginAt', width: 170, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
