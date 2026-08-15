import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Result } from 'antd';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Result
            status="500"
            title="页面出错了"
            subTitle={this.state.error?.message || '未知错误，请刷新重试'}
            extra={
              <Button type="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                刷新页面
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}