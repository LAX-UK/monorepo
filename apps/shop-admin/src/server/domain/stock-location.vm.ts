import {
  LOCATION_NAME_MAX,
  LOCATION_NOTE_MAX,
  LOCATION_NOT_RECORDED,
  MOVE_NOTE_MAX,
  locationLabel,
  locationNameKey,
  parseLocationName,
  parseLocationNote,
  parseMoveNote,
} from "@auction/artwork-register-contracts";
import {
  type AdminArtworkLocation,
  type AdminArtworkLocationMoveResult,
  type AdminStockLocation,
  REGISTER_LOCATION_NONE,
} from "@auction/shop-contracts";
import type { TimelineEvent } from "@auction/staff-ui";

/*
 * Stock location in LAX Admin (docs/design/stock-location.md): the list of places an original can
 * physically be, and where each artwork is and has been. The rules for names and notes are the
 * shared ones the API applies again, so the form and the server never disagree.
 */

export const LOCATIONS_TITLE = "Locations";
export const LOCATIONS_DESCRIPTION =
  "Where originals physically are. Moves pick from this list; retire a place instead of deleting it, so history keeps reading.";

/** Who moved an artwork, when the name is not known. */
export const UNNAMED_MOVER = "LAX staff";

// ---------------------------------------------------------------------------------------------
// Adding or renaming a location.

export type LocationFormValues = { name: string; note: string };
export type LocationFormField = keyof LocationFormValues;
export type LocationFormErrors = Partial<Record<LocationFormField, string>>;

export const LOCATION_FIELD_LABELS: Record<LocationFormField, string> = {
  name: "Name",
  note: "Note",
};

export const NAME_TAKEN = "Another location already has this name.";

export function locationFormValues(location: AdminStockLocation | null): LocationFormValues {
  return { name: location?.name ?? "", note: location?.note ?? "" };
}

/**
 * The name and note as the API takes them, or what is wrong with each. A name another location
 * already has, ignoring case, is refused here too, so the person sees it beside the field.
 */
export function checkLocationForm(
  values: LocationFormValues,
  others: readonly Pick<AdminStockLocation, "id" | "name">[],
  selfId: string | null = null,
):
  | { ok: true; body: { name: string; note: string | null } }
  | { ok: false; errors: LocationFormErrors } {
  const errors: LocationFormErrors = {};
  const name = parseLocationName(values.name);
  if (!name.ok) {
    errors.name =
      name.reason === "empty"
        ? "Give the location a name."
        : `Keep the name to ${LOCATION_NAME_MAX} characters or fewer.`;
  } else {
    const key = locationNameKey(name.value);
    if (others.some((other) => other.id !== selfId && locationNameKey(other.name) === key)) {
      errors.name = NAME_TAKEN;
    }
  }
  const note = parseLocationNote(values.note);
  if (!note.ok) errors.note = `Keep the note to ${LOCATION_NOTE_MAX} characters or fewer.`;
  if (!name.ok || !note.ok || errors.name) return { ok: false, errors };
  return { ok: true, body: { name: name.value, note: note.value } };
}

// ---------------------------------------------------------------------------------------------
// Moving one artwork or a selection.

export type MoveFormValues = { locationId: string | null; note: string };
export type MoveFormField = "locationId" | "note";
export type MoveFormErrors = Partial<Record<MoveFormField, string>>;

export const MOVE_FIELD_LABELS: Record<MoveFormField, string> = {
  locationId: "Move to",
  note: "Note",
};

export function checkMoveForm(
  values: MoveFormValues,
  active: readonly Pick<AdminStockLocation, "id">[],
):
  | { ok: true; body: { locationId: string; note: string | null } }
  | { ok: false; errors: MoveFormErrors } {
  const errors: MoveFormErrors = {};
  const locationId =
    values.locationId && active.some((location) => location.id === values.locationId)
      ? values.locationId
      : null;
  if (!locationId) errors.locationId = "Choose where the artwork is going.";
  const note = parseMoveNote(values.note);
  if (!note.ok) errors.note = `Keep the note to ${MOVE_NOTE_MAX} characters or fewer.`;
  if (!locationId || !note.ok) return { ok: false, errors };
  return { ok: true, body: { locationId, note: note.value } };
}

const artworks = (count: number) => (count === 1 ? "1 artwork" : `${count} artworks`);

/**
 * The toast after a move, from what the API did: "Moved to Store room", "3 artworks moved to
 * Store room", and the ones already there or no longer on the register when there are any.
 */
export function moveOutcomeMessage(
  result: Pick<AdminArtworkLocationMoveResult, "moved" | "unchanged" | "notFound">,
  locationName: string,
): string {
  const moved = result.moved.length;
  const parts: string[] = [];
  const total = moved + result.unchanged.length + result.notFound.length;
  if (moved > 0) {
    parts.push(
      total === 1 ? `Moved to ${locationName}` : `${artworks(moved)} moved to ${locationName}`,
    );
  }
  if (result.unchanged.length > 0) {
    parts.push(
      total === 1
        ? `Already at ${locationName}`
        : `${artworks(result.unchanged.length)} already there`,
    );
  }
  if (result.notFound.length > 0) {
    parts.push(`${artworks(result.notFound.length)} no longer on the register`);
  }
  const [first = "Nothing moved", ...rest] = parts;
  return rest.length > 0 ? `${first}; ${rest.join("; ")}` : first;
}

/** The locations a move can go to, as the select lists them. */
export function moveOptions(
  locations: readonly AdminStockLocation[],
  currentId: string | null = null,
): { value: string; label: string; description?: string }[] {
  return locations
    .filter((location) => location.status === "active")
    .map((location) => ({
      value: location.id,
      label: location.name,
      ...(location.id === currentId ? { description: "Where it is now" } : {}),
    }));
}

/** The All list's Location filter: not recorded, then every place, retired ones marked. */
export function locationFilterOptions(
  locations: readonly AdminStockLocation[],
): { value: string; label: string }[] {
  return [
    { value: REGISTER_LOCATION_NONE, label: LOCATION_NOT_RECORDED },
    ...locations.map((location) => ({
      value: location.id,
      label: locationLabel(location),
    })),
  ];
}

// ---------------------------------------------------------------------------------------------
// The Location panel on an artwork's record.

/** "Moved by Ana Ruiz", or by LAX staff when the name is not known. */
export const moverName = (name: string | null) => name ?? UNNAMED_MOVER;

/** The artwork's moves, newest first, as the shared timeline reads them. */
export function locationHistory(location: AdminArtworkLocation): TimelineEvent[] {
  return location.moves.map((move) => ({
    id: move.id,
    at: move.movedAt,
    actor: moverName(move.movedByName),
    title: move.from
      ? `${move.from.label} → ${move.to.label}`
      : `First recorded at ${move.to.label}`,
    ...(move.note ? { detail: move.note } : {}),
  }));
}

/** Said under the history when older moves are kept but not shown. */
export const moreMovesNote = (shown: number) =>
  `Showing the latest ${shown} moves. Older moves are kept.`;
