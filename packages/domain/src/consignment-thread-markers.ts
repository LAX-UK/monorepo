import type { ConsignmentMessageSide } from "./consignment-messages.js";

/**
 * What a thread remembers about its newest messages, so the inbox can list threads without
 * reading them. Everything here is about messages the client can see: an internal note never
 * moves a marker, and a staff reply the writer can still take back already counts as an answer.
 */
export type ConsignmentThreadMarkers = {
  /** The newest message the client can see (or hold for them): its time. */
  lastMessageAt: Date;
  lastMessageSide: ConsignmentMessageSide;
  /** The first client message after the last staff reply; null when nobody waits. */
  awaitingSince: Date | null;
  closedAt: Date | null;
};

export type MarkerMessage = {
  side: ConsignmentMessageSide;
  visibility: "thread" | "internal";
  at: Date;
};

/**
 * The markers once `message` is added. A client message reopens a closed thread and starts the
 * wait if nobody is waiting yet; a staff reply ends the wait and reopens a closed thread as
 * answered; a note changes nothing (but opens a thread that has no markers yet).
 */
export function markersAfterMessage(
  current: ConsignmentThreadMarkers | null,
  message: MarkerMessage,
): { markers: ConsignmentThreadMarkers; reopened: boolean } {
  if (message.visibility === "internal") {
    return {
      markers: current ?? {
        lastMessageAt: message.at,
        lastMessageSide: "staff",
        awaitingSince: null,
        closedAt: null,
      },
      reopened: false,
    };
  }
  const reopened = current?.closedAt != null;
  return {
    markers: {
      lastMessageAt: message.at,
      lastMessageSide: message.side,
      awaitingSince: message.side === "client" ? (current?.awaitingSince ?? message.at) : null,
      closedAt: null,
    },
    reopened,
  };
}

/**
 * The markers rebuilt from the messages left, oldest first, after one was taken back. `null`
 * when no message the client can see is left (the markers then stay as they are).
 */
export function markersFromMessages(
  messages: readonly MarkerMessage[],
  closedAt: Date | null,
): ConsignmentThreadMarkers | null {
  const visible = messages.filter((message) => message.visibility === "thread");
  const last = visible.at(-1);
  if (!last) return null;
  let awaitingSince: Date | null = null;
  if (last.side === "client") {
    for (let i = visible.length - 1; i >= 0; i--) {
      const message = visible[i];
      if (!message || message.side !== "client") break;
      awaitingSince = message.at;
    }
  }
  return {
    lastMessageAt: last.at,
    lastMessageSide: last.side,
    awaitingSince,
    closedAt,
  };
}
