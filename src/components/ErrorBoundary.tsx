import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Result } from 'antd';
import i18n from '../i18n/setup';

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
            title={i18n.t('errorBoundary.title')}
            subTitle={this.state.error?.message || i18n.t('errorBoundary.unknownError')}
            extra={
              <Button type="primary" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
                {i18n.t('errorBoundary.refresh')}
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}