import { Modal, Spin, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { openUrl } from '@tauri-apps/plugin-opener';
import { tauriInvoke } from '../utils/tauri';
import { authApi } from '../api/authApi';
import { setTokens } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

const MAX_WAIT_MS = 60 * 1000; // 60 秒超时兜底

/** 后端错误 → 用户友好提示映射 */
function friendlyError(err: string): { text: string; action: 'register' | 'retry' | 'close' | 'contact' } {
  const msg = err.toLowerCase();
  if (msg.includes('未绑定') || msg.includes('not bound')) {
    return { text: '此 GitHub 账号未绑定平台账号，请先注册并绑定后再试', action: 'register' };
  }
  if (msg.includes('已被其他用户绑定') || msg.includes('already bound')) {
    return { text: '此 GitHub 账号已被其他账号绑定，请解绑后再试', action: 'close' };
  }
  if (msg.includes('已被禁用') || msg.includes('disabled')) {
    return { text: '账号已被禁用，请联系客服', action: 'contact' };
  }
  if (msg.includes('state') || msg.includes('过期') || msg.includes('expired')) {
    return { text: '授权已过期，请重试', action: 'retry' };
  }
  return { text: err, action: 'close' };
}

interface OAuthModalProps {
  open: boolean;
  error?: string;
  errorAction?: 'register' | 'retry' | 'close' | 'contact';
  onCancel: () => void;
  onRetry?: () => void;
  onRegister?: () => void;
}

/**
 * 系统浏览器 OAuth 等待弹窗。
 * 支持登录失败时显示业务错误提示 + 引导按钮。
 */
export function OAuthWaitingModal({ open, error, errorAction, onCancel, onRetry, onRegister }: OAuthModalProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (errorAction === 'register') {
      if (onRegister) onRegister();
      else navigate('/auth');
    } else if (errorAction === 'retry') {
      if (onRetry) onRetry();
    } else {
      onCancel();
    }
  };

  const actionLabel = errorAction === 'register' ? '去注册' : errorAction === 'retry' ? '重试' : '关闭';

  return (
    <Modal open={open} footer={null} closable={false} width={360} centered>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {error ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
            <Text type="danger" style={{ fontSize: 14 }}>{error}</Text>
            <div style={{ marginTop: 16 }}>
              <Button type={errorAction === 'register' ? 'primary' : 'default'} onClick={handleAction}>
                {actionLabel}
              </Button>
              {errorAction !== 'close' && errorAction !== 'contact' && (
                <Button onClick={onCancel} style={{ marginLeft: 8 }}>取消</Button>
              )}
            </div>
          </>
        ) : (
          <>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 15 }}>正在等待 GitHub 授权...</Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
              已打开系统浏览器，请在浏览器中完成授权
            </Text>
            <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
              授权完成后会自动跳转回应用
            </Text>
            <div style={{ marginTop: 16 }}>
              <Button onClick={onCancel}>取消</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * 根据后端错误消息生成友好提示对象。
 */
export function parseOAuthError(errMsg: string): { text: string; action: 'register' | 'retry' | 'close' | 'contact' } {
  return friendlyError(errMsg);
}

/**
 * 执行 GitHub OAuth 登录：打开系统浏览器 → 等待本地回调 → 存储 token。
 * 仅适用于已绑定 GitHub 的账号快捷登录。
 */
export async function startGithubOAuth(): Promise<boolean> {
  // 检测 OAuth 是否可用
  try {
    await authApi.oauthCheck();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('403')) throw new Error('GitHub 登录暂未开放（后端未配置）');
    throw new Error('无法连接到服务器，请检查网络');
  }

  // 获取授权地址
  const resp = await authApi.oauthLogin();
  if (resp.code !== 200 || !resp.data?.authorizeUrl) {
    throw new Error(resp.message || '获取授权地址失败');
  }

  await tauriInvoke('oauth_reset').catch(() => {});
  await openUrl(resp.data.authorizeUrl);

  // 轮询等待本地回调服务器返回结果
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    try {
      const result = await tauriInvoke<{ token?: string; refreshToken?: string; error?: string } | null>('oauth_poll');
      if (result?.error) {
        const friendly = friendlyError(result.error);
        throw new Error(friendly.text);
      }
      if (result?.token) {
        setTokens(result.token, result.refreshToken || '');
        await useAuthStore.getState().fetchProfile().catch(() => {});
        return true;
      }
    } catch (e) {
      if (e instanceof Error && !e.message.includes('未就绪')) throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('登录超时，请重试');
}

/**
 * 执行 GitHub 绑定到当前用户。
 * 用于个人设置中绑定 GitHub 账号，流程同登录但无需存 token。
 */
export async function startGithubBind(): Promise<boolean> {
  await tauriInvoke('oauth_reset').catch(() => {});
  const resp = await authApi.oauthBind();
  if (resp.code !== 200 || !resp.data?.authorizeUrl) {
    throw new Error(resp.message || '获取绑定授权地址失败');
  }
  await openUrl(resp.data.authorizeUrl);

  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    try {
      const result = await tauriInvoke<{ token?: string; error?: string } | null>('oauth_poll');
      if (result?.error) {
        const friendly = friendlyError(result.error);
        throw new Error(friendly.text);
      }
      if (result?.token) {
        // 绑定成功，刷新页面获取最新绑定状态
        return true;
      }
    } catch (e) {
      if (e instanceof Error && !e.message.includes('未就绪')) throw e;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('绑定超时，请重试');
}