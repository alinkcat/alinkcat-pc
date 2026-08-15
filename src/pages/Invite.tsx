import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Table, Input, Typography, Space, Empty, Tooltip, Row, Col } from 'antd';
import { LinkOutlined, ReloadOutlined, UserAddOutlined, LoginOutlined } from '@ant-design/icons';
import { useInviteStore } from '../store/inviteStore';
import { useAuthStore } from '../store/authStore';
import { useMessage } from '../hooks/useMessage';

const { Text, Title } = Typography;

export default function Invite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { code, records, loading, fetchCode, fetchRecords, generateCode, bindCode } = useInviteStore();
  const { message: msg } = useMessage();
  const [bindInput, setBindInput] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      fetchCode().catch(() => {});
      fetchRecords().catch(() => {});
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('invite.title')}</h1>
          <p className="page-subtitle">{t('invite.subtitle')}</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <UserAddOutlined style={{ fontSize: 48, color: '#4F6EF7', marginBottom: 16 }} />
          <div style={{ marginBottom: 16 }}>{t('invite.loginHint')}</div>
          <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/auth')}>{t('invite.loginRequired')}</Button>
        </Card>
      </div>
    );
  }

  const handleGenerate = async () => {
    try {
      const newCode = await generateCode();
      msg.success(t('invite.codeGenerated', { code: newCode.code }));
    } catch (e) { msg.error(String(e)); }
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code.code).then(
      () => msg.success(t('invite.codeCopied')),
      () => msg.error(t('invite.copyFailed')),
    );
  };

  const handleBind = async () => {
    const val = bindInput.trim();
    if (!val) return msg.warning(t('invite.bindRequired'));
    try {
      await bindCode(val);
      msg.success(t('invite.bindSuccess'));
      setBindInput('');
      fetchCode().catch(() => {});
    } catch (e) { msg.error(String(e)); }
  };

  const recordColumns = [
    { title: t('invite.inviteCode'), dataIndex: 'inviteCode', width: 140 },
    { title: t('invite.invitee'), dataIndex: 'inviteeUsername' },
    { title: t('invite.pointsRewarded'), dataIndex: 'pointsRewarded', width: 100, render: (v: number) => <span style={{ color: '#52c41a' }}>+{v}</span> },
    { title: t('invite.time'), dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('invite.title')}</h1>
        <p className="page-subtitle">{t('invite.subtitleLoggedIn')}</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={t('invite.myInviteCode')} extra={
            <Button size="small" icon={<ReloadOutlined />} onClick={handleGenerate}>{t('invite.regenerate')}</Button>
          }>
            {code ? (
              <>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Title level={2} copyable={{ text: code.code }} style={{ marginBottom: 8, letterSpacing: 2 }}>
                    {code.code}
                  </Title>
                  <Text type="secondary">{t('invite.usedCount', { used: code.useCount, max: code.maxUse })}</Text>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Tooltip title={t('invite.codeValidity')}>
                    <Button icon={<LinkOutlined />} onClick={handleCopy}>{t('invite.copyLink')}</Button>
                  </Tooltip>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Empty description={t('invite.noCode')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button type="primary" onClick={handleGenerate}>{t('invite.generateCode')}</Button>
                </Empty>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={t('invite.bindInviteCode')}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {t('invite.bindHint')}
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder={t('invite.bindPlaceholder')}
                value={bindInput}
                onChange={(e) => setBindInput(e.target.value)}
                onPressEnter={handleBind}
              />
              <Button type="primary" onClick={handleBind}>{t('invite.bind')}</Button>
            </Space.Compact>
          </Card>
        </Col>
      </Row>

      <Card title={t('invite.inviteRecords')} style={{ marginTop: 16 }}>
        {records.length === 0 ? (
          <Empty description={t('invite.noRecords')} />
        ) : (
          <Table
            dataSource={records}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={{ pageSize: 10 }}
            columns={recordColumns}
          />
        )}
      </Card>
    </div>
  );
}
