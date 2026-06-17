import type { SaleroomDisplayControlPayload, SaleroomDisplayOverlay } from "@auction/types";

export type ClerkDisplayOverlay = {
  kind: "fair_warning" | "announcement";
  message?: string;
};

export function toClerkDisplayOverlay(
  overlay: SaleroomDisplayOverlay | null | undefined,
): ClerkDisplayOverlay | null {
  if (!overlay) return null;
  if (overlay.kind !== "fair_warning" && overlay.kind !== "announcement") return null;
  return overlay.message
    ? { kind: overlay.kind, message: overlay.message }
    : { kind: overlay.kind };
}

export function applyDisplayControlEvent(
  prev: SaleroomDisplayOverlay | null,
  event: SaleroomDisplayControlPayload,
): SaleroomDisplayOverlay | null {
  if (event.kind === "clear") return null;
  if (event.kind === "bid_summary") return prev;
  const emittedAt = event.emittedAt;
  if (prev && prev.emittedAt > emittedAt) return prev;
  return {
    kind: event.kind,
    ...(event.message ? { message: event.message } : {}),
    emittedAt,
  };
}

export function reconcileDisplayOverlay(
  live: SaleroomDisplayOverlay | null,
  fromServer: SaleroomDisplayOverlay | null,
): SaleroomDisplayOverlay | null {
  if (!fromServer) return live;
  if (!live) return fromServer;
  return live.emittedAt >= fromServer.emittedAt ? live : fromServer;
}

/** Keeps WS overlay authoritative when a stale in-flight full hydrate completes. */
export function resolveOverlayAfterFullHydrate(
  live: SaleroomDisplayOverlay | null,
  fromSnapshot: SaleroomDisplayOverlay | null,
  wsEmittedAt: string | null,
  wsChangedDuringFetch: boolean,
): SaleroomDisplayOverlay | null {
  if (wsChangedDuringFetch) return live;

  if (!fromSnapshot) {
    return null;
  }

  if (!live) {
    if (wsEmittedAt && wsEmittedAt > fromSnapshot.emittedAt) {
      return null;
    }
    return fromSnapshot;
  }

  if (live.emittedAt >= fromSnapshot.emittedAt) {
    return live;
  }

  return fromSnapshot;
}

export function parseSessionDisplayOverlay(raw: unknown): SaleroomDisplayOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "fair_warning" && kind !== "announcement") return null;
  const emittedAt =
    typeof o.emittedAt === "string" && o.emittedAt.length > 0
      ? o.emittedAt
      : new Date().toISOString();
  const message = typeof o.message === "string" && o.message.trim() ? o.message.trim() : undefined;
  return message ? { kind, message, emittedAt } : { kind, emittedAt };
}
