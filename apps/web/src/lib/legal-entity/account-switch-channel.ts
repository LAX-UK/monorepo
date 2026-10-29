/**
 * Tells the other tabs of this browser that the account Bid is used as has changed. The acting
 * account lives in a cookie every tab shares, so a page rendered for the old account must refresh
 * before it acts (a bid, a submission) for whoever is now selected.
 */
const CHANNEL_NAME = "lax-acting-account";

type Message = { type: "switched"; accountId: string; tabId: string };

/**
 * This tab's id. A `BroadcastChannel` message also reaches other listeners in the sending tab, so
 * each message names its tab and listeners ignore their own.
 */
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

/** Announces a switch to the other tabs. Best effort: older browsers rely on focus checks. */
export function announceAccountSwitch(accountId: string): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage({ type: "switched", accountId, tabId: TAB_ID } satisfies Message);
  channel.close();
}

/** Whether the browser now uses another account than the one this page was rendered for. */
export function accountChangedElsewhere(
  renderedAccountId: string | null,
  browserAccountId: string | null | undefined,
): boolean {
  return Boolean(renderedAccountId && browserAccountId && browserAccountId !== renderedAccountId);
}

/** Calls `listener` when another tab switches account. Returns the unsubscribe. */
export function onAccountSwitch(listener: (accountId: string) => void): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<Message>) => {
    if (event.data?.type === "switched" && event.data.tabId !== TAB_ID) {
      listener(event.data.accountId);
    }
  };
  return () => channel.close();
}
