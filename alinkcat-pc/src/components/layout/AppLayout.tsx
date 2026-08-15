import { useEffect } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import AppFooter from './AppFooter';

const { Content } = Layout;

export default function AppLayout() {
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return (
    <Layout className="app-layout">
      <AppHeader />
      <Layout className="app-body">
        <AppSidebar />
        <Layout className="app-main">
          <Content className="app-content">
            <Outlet />
          </Content>
          <AppFooter />
        </Layout>
      </Layout>
    </Layout>
  );
}
