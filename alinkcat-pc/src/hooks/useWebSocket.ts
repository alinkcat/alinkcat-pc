import { tauriInvoke } from '../utils/tauri';

/** send a raw message to a phone device via the PC websocket service */
export async function sendWsMessage(clientId: string, message: string): Promise<void> {
  await tauriInvoke('send_ws_message', { clientId, message });
}

/** tell the phone to cancel an in-flight theme push */
export async function sendPushCancel(themeId: string, clientId: string): Promise<void> {
  await tauriInvoke('cancel_push', { themeId, clientId });
}
