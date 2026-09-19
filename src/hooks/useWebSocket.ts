import { tauriInvoke } from '../utils/tauri';

/** send a raw message to a specific phone via the PC WebSocket service。 */
export async function sendWsMessage(clientId: string, message: string): Promise<void> {
  await tauriInvoke('send_ws_message', { clientId, message });
}

/** send theme.push.cancel to the phone to cancel。 */
export async function sendPushCancel(themeId: string, clientId: string): Promise<void> {
  await tauriInvoke('cancel_push', { themeId, clientId });
}
