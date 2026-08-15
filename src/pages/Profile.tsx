import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Avatar, Typography, Row, Col, Statistic, Tabs, Button, Input, Form, Space,
  Tag, Table, message, Empty, Modal, Divider,
} from 'antd';
import {
  UserOutlined, EditOutlined, DeleteOutlined, ExportOutlined, SwapOutlined,
  HeartFilled, LockOutlined, CrownOutlined, GithubOutlined,
} from '@ant-design/icons';
import { useProfileStore } from '../store/profileStore';
import { useAuthStore } from '../store/authStore';
import { useFavoriteStore } from '../store/favoriteStore';
import { userApi } from '../api/userApi';
import { authApi } from '../api/authApi';
import { tauriInvoke } from '../utils/tauri';
import { themeApi } from '../api/themeApi';
import { OAuthWaitingModal, startGithubBind } from '../components/OAuthLogin';
import type { ThemeSummary } from '../types/theme';
import type { ThemeItem } from '../api/types';

const { Text, Title } = Typography;

export default function Profile() {
  const navigate = useNavigate();
  const { isLoggedIn, profile: authProfile, fetchProfile } = useAuthStore();
  const { profile: localProfile, updateProfile } = useProfileStore();
  const { favorites: favIds, toggle: toggleFavorite } = useFavoriteStore();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [favItems, setFavItems] = useState<ThemeItem[]>([]);
  const [accountForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [githubBound, setGithubBound] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);
  const [bindError, setBindError] = useState('');
  const [bindErrorAction, setBindErrorAction] = useState<'register' | 'retry' | 'close' | 'contact' | undefined>(undefined);

  const isOnline = isLoggedIn;

  useEffect(() => {
    tauriInvoke<ThemeSummary[]>('scan_themes').then(setThemes).catch(() => {});
  }, []);

  useEffect(() => {
    if (favIds.length === 0) { setFavItems([]); return; }
    themeApi.list({ page: 1, size: 50, status: 1 }).then((resp) => {
      if (resp.code === 200 && resp.data) {
        setFavItems(resp.data.records.filter((t) => favIds.includes(t.themeId)));
      }
    }).catch(() => {});
  }, [favIds]);

  useEffect(() => {
    if (isOnline) {
      fetchProfile().catch(() => {});
      authApi.oauthBindStatus().then((r) => {
        if (r.code === 200) setGithubBound(r.data?.bound ?? false);
      }).catch(() => {});
    }
  }, [isOnline, fetchProfile]);

  const handleAvatarUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        if (isOnline) {
          try {
            await userApi.updateProfile({ avatar: dataUrl });
            fetchProfile().catch(() => {});
            message.success('头像已更新');
          } catch (e) { message.error(String(e)); }
        } else {
          updateProfile({ avatar: dataUrl });
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSaveAccount = async () => {
    try {
      const values = await accountForm.validateFields();
      if (isOnline) {
        await userApi.updateProfile({
          nickname: values.nickname,
          profile: values.bio,
          signature: values.signature,
          email: values.email,
          phone: values.phone,
        });
        fetchProfile().catch(() => {});
        message.success('账户信息已保存');
      } else {
        updateProfile({
          username: values.nickname || localProfile.username,
          bio: values.bio,
          apiKey: values.apiKey,
        });
        message.success('账户信息已保存（本地）');
      }
    } catch { /* validation */ }
  };

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      await userApi.changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
      message.success('密码修改成功');
      pwdForm.resetFields();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) message.error(String((e as Error).message));
    }
  };

  const handleGithubBind = async () => {
    setBindLoading(true);
    setBindOpen(true);
    setBindError('');
    setBindErrorAction(undefined);
    try {
      const ok = await startGithubBind();
      if (ok) {
        setBindOpen(false);
        message.success('GitHub 绑定成功');
        setGithubBound(true);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setBindError(errMsg);
      if (errMsg.includes('已被其他用户绑定')) {
        setBindErrorAction('close');
      } else if (errMsg.includes('超时')) {
        setBindErrorAction('retry');
      } else {
        setBindErrorAction('close');
      }
    } finally {
      setBindLoading(false);
    }
  };

  const handleGithubUnbind = async () => {
    Modal.confirm({
      title: '解绑 GitHub',
      content: '确定要解绑 GitHub 账号吗？解绑后下次无法通过 GitHub 一键登录。',
      onOk: async () => {
        try {
          await authApi.oauthUnbind();
          message.success('已解绑');
          setGithubBound(false);
        } catch (e) { message.error(String(e)); }
      },
    });
  };

  const statCards = (
    <Row gutter={16}>
      <Col xs={8}><Card><Statistic title="我的主题包" value={themes.length} /></Card></Col>
      <Col xs={8}><Card><Statistic title="下载次数" value={isOnline ? (authProfile?.id ?? 0) : localProfile.downloadCount} /></Card></Col>
      <Col xs={8}><Card><Statistic title="收藏数量" value={favIds.length} /></Card></Col>
    </Row>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">个人中心</h1>
        <p className="page-subtitle">{isOnline ? '管理个人信息、我的主题包与收藏' : '本地用户信息'}</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Avatar
                size={80}
                src={authProfile?.avatar || localProfile.avatar}
                icon={<UserOutlined />}
                onClick={handleAvatarUpload}
                style={{ cursor: 'pointer', background: '#4F6EF7' }}
              />
              <Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>
                {isOnline ? (authProfile?.nickname || authProfile?.username || '加载中...') : localProfile.username}
              </Title>
              <Text type="secondary">
                {isOnline ? (authProfile?.profile || '这个人很懒') : localProfile.bio || '艾联猫 · ailinkcat 用户'}
              </Text>
              {isOnline && authProfile?.roleName && (
                <div style={{ marginTop: 8 }}>
                  <Tag color="gold"><CrownOutlined /> {authProfile.roleName}</Tag>
                </div>
              )}
              {isOnline && authProfile?.hasMembership && (
                <div style={{ marginTop: 8 }}>
                  <Tag color="purple"><CrownOutlined /> {authProfile.membershipName}</Tag>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    有效期至 {new Date(authProfile.membershipEndDate).toLocaleDateString()}
                  </Text>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {isOnline && authProfile?.createdAt ? `注册时间：${new Date(authProfile.createdAt).toLocaleDateString()}` : isOnline ? '' : `本地用户`}
                </Text>
              </div>
              {!isOnline && (
                <Button type="primary" style={{ marginTop: 12 }} onClick={() => navigate('/auth')}>
                  登录获取更多功能
                </Button>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          {statCards}
          <Card style={{ marginTop: 16 }}>
            <Tabs
              items={[
                {
                  key: 'my',
                  label: `我的主题包 (${themes.length})`,
                  children: themes.length === 0 ? (
                    <Empty description="还没有主题包" />
                  ) : (
                    <Table
                      dataSource={themes}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        {
                          title: '名称', dataIndex: 'name',
                          render: (name: string, record: ThemeSummary) => (
                            <Space>{name}<Tag>v{record.version}</Tag></Space>
                          ),
                        },
                        { title: '描述', dataIndex: 'description', ellipsis: true, render: (d: string, record: ThemeSummary) => d || `${record.page_count} 个页面` },
                        {
                          title: '操作', width: 200,
                          render: (_: unknown, record: ThemeSummary) => (
                            <Space>
                              <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/themes/edit/${record.id}`)}>编辑</Button>
                              <Button size="small" icon={<ExportOutlined />} onClick={() => handleExport(record)}>导出</Button>
                              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id, record.name)}>删除</Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'fav',
                  label: `收藏夹 (${favItems.length})`,
                  children: favItems.length === 0 ? (
                    <Empty description="还没有收藏，去主题市场看看吧">
                      <Button type="primary" onClick={() => navigate('/market')}>去逛逛</Button>
                    </Empty>
                  ) : (
                    <Table
                      dataSource={favItems}
                      rowKey="themeId"
                      size="small"
                      pagination={false}
                      columns={[
                        { title: '名称', dataIndex: 'name', render: (n: string) => <Space>{n}<HeartFilled style={{ color: '#ff4d4f' }} /></Space> },
                        { title: '作者', dataIndex: 'author', width: 120 },
                        { title: '下载', dataIndex: 'downloadCount', width: 80 },
                        {
                          title: '操作', width: 160,
                          render: (_: unknown, record: ThemeItem) => (
                            <Space>
                              <Button size="small" onClick={() => navigate(`/market/${record.id}`)}>查看</Button>
                              <Button size="small" icon={<SwapOutlined />} onClick={() => toggleFavorite(record.themeId)}>取消收藏</Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'account',
                  label: '账户设置',
                  children: (
                    <Form
                      form={accountForm}
                      layout="vertical"
                      initialValues={isOnline ? {
                        nickname: authProfile?.nickname,
                        bio: authProfile?.profile,
                        email: authProfile?.email,
                        phone: authProfile?.phone,
                        signature: authProfile?.signature,
                      } : {
                        nickname: localProfile.username,
                        bio: localProfile.bio,
                        apiKey: localProfile.apiKey,
                      }}
                      style={{ maxWidth: 480 }}
                    >
                      <Form.Item name="nickname" label="昵称"><Input /></Form.Item>
                      <Form.Item name="bio" label="个人简介"><Input.TextArea rows={2} /></Form.Item>
                      {isOnline ? (
                        <>
                          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
                          <Form.Item name="phone" label="手机号"><Input /></Form.Item>
                          <Form.Item name="signature" label="个性签名"><Input /></Form.Item>
                        </>
                      ) : (
                        <Form.Item name="apiKey" label="市场 API Key">
                          <Input.Password placeholder="用于上传主题包到市场" />
                        </Form.Item>
                      )}
                      <Button type="primary" onClick={handleSaveAccount}>保存设置</Button>
                    </Form>
                  ),
                },
                ...(isOnline ? [{
                  key: 'security',
                  label: '安全设置',
                  children: (
                    <><Form form={pwdForm} layout="vertical" style={{ maxWidth: 480 }}>
                      <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Form.Item name="confirmPassword" label="确认密码" dependencies={['newPassword']}
                        rules={[
                          { required: true, message: '请确认密码' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                              return Promise.reject(new Error('两次密码不一致'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Button type="primary" danger onClick={handleChangePassword}>
                        <LockOutlined /> 修改密码
                      </Button>
                    </Form>
                    <Divider />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>GitHub 账号绑定</div>
                      <div style={{ marginBottom: 12 }}>
                        <Tag color={githubBound ? 'success' : 'default'}>{githubBound ? '已绑定' : '未绑定'}</Tag>
                      </div>
                      <Space>
                        {githubBound ? (
                          <Button onClick={handleGithubUnbind}>
                            <GithubOutlined /> 解绑 GitHub
                          </Button>
                        ) : (
                          <Button type="primary" loading={bindLoading} onClick={handleGithubBind}>
                            <GithubOutlined /> 绑定 GitHub
                          </Button>
                        )}
                      </Space>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                        GitHub 仅作为已绑定账号的快捷登录方式，不支持注册。绑定后可在登录页使用 GitHub 一键登录。
                      </div>
                    </div>
                    </>
                  ),
                }] : []),
              ]}
            />
          </Card>
        </Col>
      </Row>
      <OAuthWaitingModal
        open={bindOpen}
        error={bindError}
        errorAction={bindErrorAction}
        onCancel={() => setBindOpen(false)}
        onRetry={() => {
          setBindOpen(false);
          setTimeout(handleGithubBind, 100);
        }}
      />
    </div>
  );

  async function handleExport(t: ThemeSummary) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({ defaultPath: `${t.name}_${t.version}.alc`, filters: [{ name: '主题包 (.alc)', extensions: ['alc'] }] });
      if (!path) return;
      await tauriInvoke('export_theme', { id: t.id, outputPath: path });
      message.success('导出成功');
    } catch (e) { message.error(String(e)); }
  }

  function handleDelete(id: string, name: string) {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除主题包「${name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await tauriInvoke('delete_theme', { id });
          message.success('已删除');
          tauriInvoke<ThemeSummary[]>('scan_themes').then(setThemes).catch(() => {});
        } catch (e) { message.error(String(e)); }
      },
    });
  }
}
