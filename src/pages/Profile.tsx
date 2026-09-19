import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card, Avatar, Typography, Row, Col, Statistic, Tabs, Button, Input, Form, Space,
  Tag, Table, Empty, Modal, Divider,
} from 'antd';
import { message } from '../utils/message';
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
  const { t } = useTranslation();
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
            message.success(t('profile.avatarUpdated'));
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
        message.success(t('profile.accountSaved'));
      } else {
        updateProfile({
          username: values.nickname || localProfile.username,
          bio: values.bio,
          apiKey: values.apiKey,
        });
        message.success(t('profile.accountSavedLocal'));
      }
    } catch { /* validation */ }
  };

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      await userApi.changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
      message.success(t('profile.passwordChanged'));
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
        message.success(t('profile.githubBindSuccess'));
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
      title: t('profile.confirmUnbindGithubTitle'),
      content: t('profile.confirmUnbindGithubContent'),
      onOk: async () => {
        try {
          await authApi.oauthUnbind();
          message.success(t('profile.githubUnbindSuccess'));
          setGithubBound(false);
        } catch (e) { message.error(String(e)); }
      },
    });
  };

  const statCards = (
    <Row gutter={16}>
      <Col xs={8}><Card><Statistic title={t('profile.myThemes')} value={themes.length} /></Card></Col>
      <Col xs={8}><Card><Statistic title={t('profile.downloadCount')} value={isOnline ? (authProfile?.id ?? 0) : localProfile.downloadCount} /></Card></Col>
      <Col xs={8}><Card><Statistic title={t('profile.favoriteCount')} value={favIds.length} /></Card></Col>
    </Row>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('profile.profileCenter')}</h1>
        <p className="page-subtitle">{isOnline ? t('profile.profileCenterDescOnline') : t('profile.profileCenterDescLocal')}</p>
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
                {isOnline ? (authProfile?.nickname || authProfile?.username || t('profile.loading')) : localProfile.username}
              </Title>
              <Text type="secondary">
                {isOnline ? (authProfile?.profile || t('profile.userBioEmpty')) : localProfile.bio || t('profile.defaultBio')}
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
                    {t('profile.membershipValidUntil', { date: new Date(authProfile.membershipEndDate).toLocaleDateString() })}
                  </Text>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {isOnline && authProfile?.createdAt ? t('profile.registerTime', { date: new Date(authProfile.createdAt).toLocaleDateString() }) : isOnline ? '' : t('profile.localUser')}
                </Text>
              </div>
              {!isOnline && (
                <Button type="primary" style={{ marginTop: 12 }} onClick={() => navigate('/auth')}>
                  {t('profile.loginForMore')}
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
                  label: t('profile.myThemesCount', { count: themes.length }),
                  children: themes.length === 0 ? (
                    <Empty description={t('profile.noThemes')} />
                  ) : (
                    <Table
                      dataSource={themes}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        {
                          title: t('profile.name'), dataIndex: 'name',
                          render: (name: string, record: ThemeSummary) => (
                            <Space>{name}<Tag>v{record.version}</Tag></Space>
                          ),
                        },
                        { title: t('profile.description'), dataIndex: 'description', ellipsis: true, render: (d: string, record: ThemeSummary) => d || t('profile.pages', { count: record.page_count }) },
                        {
                          title: t('profile.actions'), width: 200,
                          render: (_: unknown, record: ThemeSummary) => (
                            <Space>
                              <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/themes/edit/${record.id}`)}>{t('profile.edit')}</Button>
                              <Button size="small" icon={<ExportOutlined />} onClick={() => handleExport(record)}>{t('profile.export')}</Button>
                              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id, record.name)}>{t('profile.delete')}</Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'fav',
                  label: t('profile.favoritesCount', { count: favItems.length }),
                  children: favItems.length === 0 ? (
                    <Empty description={t('profile.noFavorites')}>
                      <Button type="primary" onClick={() => navigate('/market')}>{t('profile.goToMarket')}</Button>
                    </Empty>
                  ) : (
                    <Table
                      dataSource={favItems}
                      rowKey="themeId"
                      size="small"
                      pagination={false}
                      columns={[
                        { title: t('profile.name'), dataIndex: 'name', render: (n: string) => <Space>{n}<HeartFilled style={{ color: '#ff4d4f' }} /></Space> },
                        { title: t('profile.author'), dataIndex: 'author', width: 120 },
                        { title: t('profile.download'), dataIndex: 'downloadCount', width: 80 },
                        {
                          title: t('profile.actions'), width: 160,
                          render: (_: unknown, record: ThemeItem) => (
                            <Space>
                              <Button size="small" onClick={() => navigate(`/market/${record.id}`)}>{t('profile.view')}</Button>
                              <Button size="small" icon={<SwapOutlined />} onClick={() => toggleFavorite(record.themeId)}>{t('profile.unfavorite')}</Button>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'account',
                  label: t('profile.accountSettings'),
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
                      <Form.Item name="nickname" label={t('profile.nickname')}><Input /></Form.Item>
                      <Form.Item name="bio" label={t('profile.bio')}><Input.TextArea rows={2} /></Form.Item>
                      {isOnline ? (
                        <>
                          <Form.Item name="email" label={t('profile.email')}><Input /></Form.Item>
                          <Form.Item name="phone" label={t('profile.phone')}><Input /></Form.Item>
                          <Form.Item name="signature" label={t('profile.signature')}><Input /></Form.Item>
                        </>
                      ) : (
                        <Form.Item name="apiKey" label={t('profile.marketApiKey')}>
                          <Input.Password placeholder={t('profile.marketApiKeyPlaceholder')} />
                        </Form.Item>
                      )}
                      <Button type="primary" onClick={handleSaveAccount}>{t('profile.saveSettings')}</Button>
                    </Form>
                  ),
                },
                ...(isOnline ? [{
                  key: 'security',
                  label: t('profile.securitySettings'),
                  children: (
                    <><Form form={pwdForm} layout="vertical" style={{ maxWidth: 480 }}>
                      <Form.Item name="oldPassword" label={t('profile.currentPassword')} rules={[{ required: true, message: t('profile.enterCurrentPassword') }]}>
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Form.Item name="newPassword" label={t('profile.newPassword')} rules={[{ required: true, min: 6, message: t('profile.passwordRule') }]}>
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Form.Item name="confirmPassword" label={t('profile.confirmPassword')} dependencies={['newPassword']}
                        rules={[
                          { required: true, message: t('profile.enterConfirmPassword') },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                              return Promise.reject(new Error(t('profile.passwordMismatch')));
                            },
                          }),
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} />
                      </Form.Item>
                      <Button type="primary" danger onClick={handleChangePassword}>
                        <LockOutlined /> {t('profile.changePassword')}
                      </Button>
                    </Form>
                    <Divider />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('profile.githubBinding')}</div>
                      <div style={{ marginBottom: 12 }}>
                        <Tag color={githubBound ? 'success' : 'default'}>{githubBound ? t('profile.githubBound') : t('profile.githubUnbound')}</Tag>
                      </div>
                      <Space>
                        {githubBound ? (
                          <Button onClick={handleGithubUnbind}>
                            <GithubOutlined /> {t('profile.unbindGithub')}
                          </Button>
                        ) : (
                          <Button type="primary" loading={bindLoading} onClick={handleGithubBind}>
                            <GithubOutlined /> {t('profile.bindGithub')}
                          </Button>
                        )}
                      </Space>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                        {t('profile.githubBindHint')}
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

  async function handleExport(theme: ThemeSummary) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({ defaultPath: `${theme.name}_${theme.version}.alc`, filters: [{ name: t('profile.alcFilter'), extensions: ['alc'] }] });
      if (!path) return;
      await tauriInvoke('export_theme', { id: theme.id, outputPath: path });
      message.success(t('profile.exportSuccess'));
    } catch (e) { message.error(String(e)); }
  }

  function handleDelete(id: string, name: string) {
    Modal.confirm({
      title: t('profile.confirmDeleteTitle'),
      content: t('profile.confirmDeleteContent', { name }),
      okText: t('profile.confirmDelete'),
      okType: 'danger',
      cancelText: t('profile.cancel'),
      onOk: async () => {
        try {
          await tauriInvoke('delete_theme', { id });
          message.success(t('profile.deleted'));
          tauriInvoke<ThemeSummary[]>('scan_themes').then(setThemes).catch(() => {});
        } catch (e) { message.error(String(e)); }
      },
    });
  }
}
