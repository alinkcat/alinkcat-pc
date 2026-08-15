import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Table, Input, Typography, Space, Empty, Tooltip, Row, Col } from 'antd';
import { LinkOutlined, ReloadOutlined, UserAddOutlined, LoginOutlined } from '@ant-design/icons';
import { useInviteStore } from '../store/inviteStore';
import { useAuthStore } from '../store/authStore';
import { useMessage } from '../hooks/useMessage';

const { Text, Title } = Typography;

export default function Invite() {
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
          <h1 className="page-title">邀请好友</h1>
          <p className="page-subtitle">邀请好友注册，双方均可获得积分奖励</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <UserAddOutlined style={{ fontSize: 48, color: '#4F6EF7', marginBottom: 16 }} />
          <div style={{ marginBottom: 16 }}>登录后即可获取专属邀请码</div>
          <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/auth')}>去登录</Button>
        </Card>
      </div>
    );
  }

  const handleGenerate = async () => {
    try {
      const newCode = await generateCode();
      msg.success(`邀请码已生成: ${newCode.code}`);
    } catch (e) { msg.error(String(e)); }
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code.code).then(
      () => msg.success('邀请码已复制'),
      () => msg.error('复制失败'),
    );
  };

  const handleBind = async () => {
    const val = bindInput.trim();
    if (!val) return msg.warning('请输入邀请码');
    try {
      await bindCode(val);
      msg.success('绑定成功！你已获得 50 积分奖励');
      setBindInput('');
      fetchCode().catch(() => {});
    } catch (e) { msg.error(String(e)); }
  };

  const recordColumns = [
    { title: '邀请码', dataIndex: 'inviteCode', width: 140 },
    { title: '被邀请人', dataIndex: 'inviteeUsername' },
    { title: '奖励积分', dataIndex: 'pointsRewarded', width: 100, render: (v: number) => <span style={{ color: '#52c41a' }}>+{v}</span> },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">邀请好友</h1>
        <p className="page-subtitle">邀请人 +100 积分，被邀请人 +50 积分</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="我的邀请码" extra={
            <Button size="small" icon={<ReloadOutlined />} onClick={handleGenerate}>重新生成</Button>
          }>
            {code ? (
              <>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Title level={2} copyable={{ text: code.code }} style={{ marginBottom: 8, letterSpacing: 2 }}>
                    {code.code}
                  </Title>
                  <Text type="secondary">已使用 {code.useCount} / {code.maxUse} 次</Text>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Tooltip title="邀请码有效期与账户绑定">
                    <Button icon={<LinkOutlined />} onClick={handleCopy}>复制邀请链接</Button>
                  </Tooltip>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Empty description="还没有邀请码" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                  <Button type="primary" onClick={handleGenerate}>生成邀请码</Button>
                </Empty>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="绑定邀请码">
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              如果你是被邀请的新用户，请在此输入邀请码绑定
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入邀请码"
                value={bindInput}
                onChange={(e) => setBindInput(e.target.value)}
                onPressEnter={handleBind}
              />
              <Button type="primary" onClick={handleBind}>绑定</Button>
            </Space.Compact>
          </Card>
        </Col>
      </Row>

      <Card title="邀请记录" style={{ marginTop: 16 }}>
        {records.length === 0 ? (
          <Empty description="暂无邀请记录" />
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
