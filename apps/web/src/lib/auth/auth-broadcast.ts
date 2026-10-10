/** Cross-tab auth events: the Bid BFF session has no built-in multi-tab channel. */
export const AUTH_BROADCAST_CHANNEL = "lax-auth";

export type AuthBroadcastMessage = { type: "signed-in" } | { type: "signed-out" };

export function postAuthBroadcast(message: AuthBroadcastMessage): void {
  try {
    const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    bc.postMessage(message);
    bc.close();
  } catch {
    /* ignore unsupported environments */
  }
}
