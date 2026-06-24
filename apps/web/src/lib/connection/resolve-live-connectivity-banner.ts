import {
  type LiveConnectivityScope,
  type SocketCopyScope,
  noticeScopeForId,
  socketMessageForScope,
} from "@/lib/connection/live-connectivity-copy";
import type { LiveConnectivityNotice } from "@/lib/connection/live-connectivity-notice";
import type { LiveConnectionState } from "@/lib/connection/merge-connection-status";

export type LiveConnectivityBannerPresentation = {
  state: LiveConnectionState;
  message: string | null;
};

function socketConnectionMessage(
  state: LiveConnectionState,
  scope: SocketCopyScope,
): string | null {
  if (state === "live") return null;
  return socketMessageForScope(scope, state);
}

function scopedHydrateNotice(
  notices: readonly LiveConnectivityNotice[],
  scope: SocketCopyScope,
): LiveConnectivityNotice | null {
  return notices.find((n) => noticeScopeForId(n.id) === scope) ?? null;
}

function hybridHydrateNotice(
  notices: readonly LiveConnectivityNotice[],
): LiveConnectivityNotice | null {
  return scopedHydrateNotice(notices, "bidding") ?? scopedHydrateNotice(notices, "saleroom");
}

/** Merges socket health and hydrate notices into a single banner presentation. */
export function resolveLiveConnectivityBanner(input: {
  scope: LiveConnectivityScope;
  connectionState: LiveConnectionState;
  notices: readonly LiveConnectivityNotice[];
}): LiveConnectivityBannerPresentation {
  if (input.scope === "hybrid") {
    const socketMessage = socketConnectionMessage(input.connectionState, "bidding");
    if (socketMessage) {
      return { state: input.connectionState, message: socketMessage };
    }
    const notice = hybridHydrateNotice(input.notices);
    if (notice) {
      return { state: "degraded", message: notice.message };
    }
    return { state: "live", message: null };
  }

  const socketMessage = socketConnectionMessage(input.connectionState, input.scope);
  if (socketMessage) {
    return { state: input.connectionState, message: socketMessage };
  }

  const notice = scopedHydrateNotice(input.notices, input.scope);
  if (notice) {
    return { state: "degraded", message: notice.message };
  }

  return { state: "live", message: null };
}
