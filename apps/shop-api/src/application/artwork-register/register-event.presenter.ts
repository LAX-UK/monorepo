import type { AdminRegisterEvent } from "@auction/shop-contracts";
import type { RegisterEventRecord } from "../ports/artwork-register-review.ports.js";

const STAFF_PREFIX = "staff:";

/** The staff ids behind the events, for one lookup of names. */
export function staffIdsOf(events: readonly RegisterEventRecord[]): string[] {
  return events
    .filter((event) => event.actor.startsWith(STAFF_PREFIX))
    .map((event) => event.actor.slice(STAFF_PREFIX.length));
}

/** The actor says which kind of party acted; a staff member is named when their name is known. */
export function presentRegisterEvent(
  event: RegisterEventRecord,
  names: ReadonlyMap<string, string>,
): AdminRegisterEvent {
  const actor = event.actor.startsWith(STAFF_PREFIX)
    ? "staff"
    : event.actor === "zoho"
      ? "zoho"
      : "system";
  return {
    id: event.id,
    type: event.type,
    actor,
    actorName:
      actor === "staff" ? (names.get(event.actor.slice(STAFF_PREFIX.length)) ?? null) : null,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

/** The moves that put an artwork somewhere. */
const MOVE_TYPES: ReadonlySet<string> = new Set([
  "offer_moved",
  "lax_art_draft_created",
  "move_confirmed",
]);

/** The latest few moves, newest first. */
export function recentMovesOf(
  events: readonly RegisterEventRecord[],
  limit: number,
): RegisterEventRecord[] {
  return events
    .filter((event) => MOVE_TYPES.has(event.type))
    .slice(-limit)
    .reverse();
}
