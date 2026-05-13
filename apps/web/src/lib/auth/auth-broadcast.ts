/** Cross-tab auth events (logout, etc.). */
export const AUTH_BROADCAST_CHANNEL = "lax-auth";

export type AuthBroadcastMessage = { type: "signed-out" };
