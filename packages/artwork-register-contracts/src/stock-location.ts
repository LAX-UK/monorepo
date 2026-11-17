import { z } from "zod";

/**
 * Stock location: where an original physically is (a room, the store, the framer), kept apart
 * from where it is offered (`offer-state.ts`, "Where it is"). Design: docs/design/stock-location.md.
 *
 * Staff keep a controlled list of locations; each move of an artwork is recorded, and its current
 * location is the latest move. These are the rules every caller shares: the text limits (the
 * database repeats them), how a location reads, and whether a move changes anything.
 */

export const LOCATION_NAME_MAX = 80;
export const LOCATION_NOTE_MAX = 200;
export const MOVE_NOTE_MAX = 500;
/** The most artworks one "Move selected" takes, so one transaction stays short. */
export const MOVE_BATCH_MAX = 100;

/** How an artwork with no move reads. */
export const LOCATION_NOT_RECORDED = "Location not recorded";

export type LocationStatus = "active" | "retired";

export type StockLocation = {
  id: string;
  name: string;
  note: string | null;
  status: LocationStatus;
  /** Optimistic lock for renames and retiring. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
  retiredAt: Date | null;
};

/** A location as a move or a record shows it. */
export type LocationRef = { id: string; name: string; status: LocationStatus };

export type CurrentLocation = {
  location: LocationRef;
  movedAt: Date;
  /** `staff:<user id>`. */
  movedBy: string;
};

export type LocationMove = {
  id: string;
  registerId: string;
  /** Where the artwork was before; null for its first recorded move. */
  from: LocationRef | null;
  to: LocationRef;
  movedAt: Date;
  /** `staff:<user id>`. */
  movedBy: string;
  note: string | null;
};

export type TextRefusal = "empty" | "too_long";

export type ParsedText<T> = { ok: true; value: T } | { ok: false; reason: TextRefusal };

/** Characters as Postgres counts them (code points), not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

/** Trims and collapses runs of spaces, so "Store  room " and "Store room" are one name. */
function tidy(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** A location's name: required, at most 80 characters. */
export function parseLocationName(raw: string): ParsedText<string> {
  const value = tidy(raw);
  if (value === "") return { ok: false, reason: "empty" };
  if (length(value) > LOCATION_NAME_MAX) return { ok: false, reason: "too_long" };
  return { ok: true, value };
}

function parseOptionalNote(raw: string | null | undefined, max: number): ParsedText<string | null> {
  const value = raw?.trim() ?? "";
  if (value === "") return { ok: true, value: null };
  if (length(value) > max) return { ok: false, reason: "too_long" };
  return { ok: true, value };
}

/** A location's optional short note; blank means none. */
export function parseLocationNote(raw: string | null | undefined): ParsedText<string | null> {
  return parseOptionalNote(raw, LOCATION_NOTE_MAX);
}

/** A move's optional note; blank means none. */
export function parseMoveNote(raw: string | null | undefined): ParsedText<string | null> {
  return parseOptionalNote(raw, MOVE_NOTE_MAX);
}

/** Names are unique ignoring case; this is the form the database compares. */
export function locationNameKey(name: string): string {
  return tidy(name).toLowerCase();
}

/** How a location reads: its name, marked when it has been retired. */
export function locationLabel(location: LocationRef): string {
  return location.status === "retired" ? `${location.name} (retired)` : location.name;
}

/** How an artwork's current location reads, including when none has been recorded. */
export function currentLocationLabel(current: CurrentLocation | null): string {
  return current ? locationLabel(current.location) : LOCATION_NOT_RECORDED;
}

export type LocationMoveRefusal = "location_not_found" | "location_retired" | "too_many";

/**
 * The artworks one move takes: each once, in id order (the order they are locked in), and no
 * more than `MOVE_BATCH_MAX`. The route and the store both apply it, so no caller can open a long
 * transaction by sending a large selection.
 */
export function planMoveBatch(
  registerIds: readonly string[],
): { ok: true; registerIds: string[] } | { ok: false; reason: "too_many" } {
  const unique = [...new Set(registerIds)].sort();
  if (unique.length > MOVE_BATCH_MAX) return { ok: false, reason: "too_many" };
  return { ok: true, registerIds: unique };
}

/**
 * The body of a move request ("Move" on a record, or "Move selected"). Repeats count once toward
 * `MOVE_BATCH_MAX`, as in `planMoveBatch`.
 */
export const moveArtworksRequestSchema = z.object({
  registerIds: z
    .array(z.string().uuid())
    .min(1)
    .refine((ids) => planMoveBatch(ids).ok, {
      message: `Move at most ${MOVE_BATCH_MAX} artworks at a time.`,
    }),
  locationId: z.string().uuid(),
  note: z.string().nullable().optional(),
});
export type MoveArtworksRequest = z.infer<typeof moveArtworksRequestSchema>;

/**
 * Whether moving an artwork to `target` is allowed and changes anything. Only active locations
 * take artworks; moving an artwork to where it already is records nothing, so a repeated or
 * overlapping "Move selected" is safe.
 */
export function planLocationMove(input: {
  target: Pick<StockLocation, "id" | "status"> | null;
  currentLocationId: string | null;
}): { ok: true; changes: boolean } | { ok: false; reason: LocationMoveRefusal } {
  if (!input.target) return { ok: false, reason: "location_not_found" };
  if (input.target.status !== "active") return { ok: false, reason: "location_retired" };
  return { ok: true, changes: input.currentLocationId !== input.target.id };
}

/**
 * The time a move is recorded at: `now`, or just after the artwork's previous move when the
 * clock repeats or steps back, so the latest move is always the current location.
 */
export function nextMoveTime(now: Date, previous: Date | null): Date {
  return previous && previous.getTime() >= now.getTime() ? new Date(previous.getTime() + 1) : now;
}
