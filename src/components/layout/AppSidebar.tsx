import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Button, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined, DesktopOutlined, EditOutlined, SettingOutlined,
  ShopOutlined, UserOutlined, LoginOutlined, LogoutOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { APP_VERSION } from '../../config';

const { Sider } = Layout;

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, profile, logout } = useAuthStore();

  const selectedKey = location.pathname === '/' ? '/themes' : location.pathname;

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const items: MenuProps['items'] = [
    { key: '/themes', icon: <AppstoreOutlined />, label: '主题包管理' },
    { key: '/devices', icon: <DesktopOutlined />, label: '设备管理' },
    { key: '/snippets', icon: <EditOutlined />, label: '快捷输入' },
    { key: '/market', icon: <ShopOutlined />, label: '主题市场' },
    { type: 'divider' },
    { key: '/profile', icon: <UserOutlined />, label: '个人中心' },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  // Admin-only items
  if (profile?.roleCode === 'ADMIN') {
    items.push(
      { type: 'divider' as const },
      { key: '/admin', icon: <SettingOutlined />, label: '管理后台' },
      { key: '/admin/themes', icon: <AppstoreOutlined />, label: '主题审核' },
      { key: '/admin/tickets', icon: <MessageOutlined />, label: '工单管理' },
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
          <Tooltip title={collapsed ? '登录/注册' : ''} placement="right">
            <Button
              type="text"
              icon={<LoginOutlined />}
              style={{ color: 'rgba(255,255,255,0.65)', width: '100%' }}
              onClick={() => navigate('/auth')}
            >
              {collapsed ? '' : '登录 / 注册'}
            </Button>
          </Tooltip>
        )}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
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
            退出登录
          </Button>
        </div>
      )}
    </Sider>
  );
}
