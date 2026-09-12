import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Button, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined, DesktopOutlined, EditOutlined, SettingOutlined,
  ShopOutlined, UserOutlined, LoginOutlined, LogoutOutlined,
  MessageOutlined, CloudOutlined, CrownOutlined, CloudServerOutlined,
  TrophyOutlined, CustomerServiceOutlined, TeamOutlined, LockOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { APP_VERSION } from '../../config';

const { Sider } = Layout;

// 云服务子菜单的子页面路径（用于自动展开菜单）
const CLOUD_PATHS = ['/member', '/mycloud', '/points', '/tickets', '/invite'];

export default function AppSidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, profile, logout } = useAuthStore();
  const [openKeys, setOpenKeys] = useState<string[]>(['/cloud']);

  const selectedKey = location.pathname === '/' ? '/themes' : location.pathname;

  // 当位于云服务子页面时确保父菜单展开（仅登录态有子菜单）
  useEffect(() => {
    if (!isLoggedIn) return;
    if (CLOUD_PATHS.some((p) => location.pathname.startsWith(p))) {
      setOpenKeys((prev) => (prev.includes('/cloud') ? prev : [...prev, '/cloud']));
    }
  }, [location.pathname, isLoggedIn]);

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys);
  };

  // 云服务子菜单：未登录时折叠为单个"登录后使用"入口（锁定态）
  const cloudMenu = !isLoggedIn
    ? {
        key: '/auth',
        icon: <LockOutlined />,
        label: t('layout.sidebar.cloudLoginRequired'),
      }
    : {
        key: '/cloud',
        icon: <CloudOutlined />,
        label: t('layout.sidebar.cloudServices'),
        children: [
          { key: '/member', icon: <CrownOutlined />, label: t('layout.sidebar.member') },
          { key: '/mycloud', icon: <CloudServerOutlined />, label: t('layout.sidebar.mycloud') },
          { key: '/points', icon: <TrophyOutlined />, label: t('layout.sidebar.points') },
          { key: '/tickets', icon: <CustomerServiceOutlined />, label: t('layout.sidebar.tickets') },
          { key: '/invite', icon: <TeamOutlined />, label: t('layout.sidebar.invite') },
        ],
      };

  const items: MenuProps['items'] = [
    { key: '/themes', icon: <AppstoreOutlined />, label: t('layout.sidebar.themes') },
    { key: '/devices', icon: <DesktopOutlined />, label: t('layout.sidebar.devices') },
    { key: '/snippets', icon: <EditOutlined />, label: t('layout.sidebar.snippets') },
    { key: '/market', icon: <ShopOutlined />, label: t('layout.sidebar.market') },
    { type: 'divider' },
    cloudMenu,
    { type: 'divider' },
    { key: '/profile', icon: <UserOutlined />, label: t('layout.sidebar.profile') },
    { key: '/settings', icon: <SettingOutlined />, label: t('layout.sidebar.settings') },
  ];

  // Admin-only items
  if (profile?.roleCode === 'ADMIN') {
    items.push(
      { type: 'divider' as const },
      { key: '/admin', icon: <SettingOutlined />, label: t('layout.sidebar.admin') },
      { key: '/admin/themes', icon: <AppstoreOutlined />, label: t('layout.sidebar.adminThemes') },
      { key: '/admin/tickets', icon: <MessageOutlined />, label: t('layout.sidebar.adminTickets') },
    );
  }

  return (
    <Sider
      className="app-sider"
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint="lg"
      onBreakpoint={(broken) => { if (broken) setCollapsed(true); }}
      width={200}
      collapsedWidth={64}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ flexShrink: 0, padding: collapsed ? '12px 0' : '12px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {isLoggedIn && profile ? (
          <Tooltip title={collapsed ? (profile.nickname || profile.username) : ''} placement="right">
            <Avatar
              src={profile.avatar}
              size={collapsed ? 32 : 40}
              style={{ background: '#4F6EF7', cursor: 'pointer' }}
              onClick={() => navigate('/profile')}
            />
            {!collapsed && (
              <div style={{ fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.nickname || profile.username}
              </div>
            )}
          </Tooltip>
        ) : (
          <Tooltip title={collapsed ? t('layout.sidebar.loginTip') : ''} placement="right">
            <Button
              type="text"
              icon={<LoginOutlined />}
              style={{ width: '100%' }}
              onClick={() => navigate('/auth')}
            >
              {collapsed ? '' : t('layout.sidebar.loginRegister')}
            </Button>
          </Tooltip>
        )}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={onOpenChange}
        items={items}
        onClick={onMenuClick}
        style={{ flex: 1, minHeight: 0, borderRight: 0, overflowY: 'auto' }}
      />
      {isLoggedIn && !collapsed && (
        <div style={{ flexShrink: 0, width: '100%', padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 4 }}>v{APP_VERSION}</div>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            danger
            style={{ width: '100%', fontSize: 12 }}
            onClick={async () => { await logout(); navigate('/auth'); }}
          >
            {t('layout.sidebar.logout')}
          </Button>
        </div>
      )}
    </Sider>
  );
}