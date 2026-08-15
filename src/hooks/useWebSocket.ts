import { tauriInvoke } from '../utils/tauri';

/** 通过 PC 端 WebSocket 服务向指定手机设备发送一条原始消息。 */
export async function sendWsMessage(clientId: string, message: string): Promise<void> {
  await tauriInvoke('send_ws_message', { clientId, message });
}

/** 向手机端发送 theme.push.cancel 取消通知。 */
export async function sendPushCancel(themeId: string, clientId: string): Promise<void> {
  await tauriInvoke('cancel_push', { themeId, clientId });
}
