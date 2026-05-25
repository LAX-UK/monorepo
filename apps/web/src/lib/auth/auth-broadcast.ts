/** Cross-tab sign-in events (Better Auth handles sign-out via its own storage channel). */
export const AUTH_BROADCAST_CHANNEL = "lax-auth";

export type AuthBroadcastMessage = { type: "signed-in" };

export function postAuthBroadcast(message: AuthBroadcastMessage): void {
  try {
    const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    bc.postMessage(message);
    bc.close();
  } catch {
    /* ignore unsupported environments */
  }
}
