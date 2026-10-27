/**
 * Tells the other tabs of this browser that the account Bid is used as has changed. The acting
 * account lives in a cookie every tab shares, so a page rendered for the old account must refresh
 * before it acts (a bid, a submission) for whoever is now selected.
 */
const CHANNEL_NAME = "lax-acting-account";

type Message = { type: "switched"; accountId: string };

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

/** Announces a switch to the other tabs. Best effort: older browsers rely on focus checks. */
export function announceAccountSwitch(accountId: string): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage({ type: "switched", accountId } satisfies Message);
  channel.close();
}

/** Calls `listener` when another tab switches account. Returns the unsubscribe. */
export function onAccountSwitch(listener: (accountId: string) => void): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<Message>) => {
    if (event.data?.type === "switched") listener(event.data.accountId);
  };
  return () => channel.close();
}
