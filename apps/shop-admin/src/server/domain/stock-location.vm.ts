import {
  type AdminArtworkLocation,
  type AdminArtworkLocationMoveResult,
  type AdminStockLocation,
  REGISTER_LOCATION_NONE,
} from "@auction/shop-contracts";
import type { TimelineEvent } from "@auction/staff-ui";

/*
 * Stock location in LAX Admin (docs/design/stock-location.md): the list of places an original can
 * physically be, and where each artwork is and has been. The rules for names and notes live in
 * `artwork-register-contracts` and run in shop-api, which names each field at fault (`issues`);
 * the forms show those beside their fields rather than repeating the rules.
 */

export const LOCATIONS_TITLE = "Locations";
export const LOCATIONS_DESCRIPTION =
  "Where originals physically are. Moves pick from this list; retire a place instead of deleting it, so history keeps reading.";

/** An artwork with no move recorded, as the Location filter offers it. */
export const LOCATION_NOT_RECORDED = "Location not recorded";

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

/** The name and note as typed; shop-api trims them and treats a blank note as none. */
export function locationFormBody(values: LocationFormValues): {
  name: string;
  note: string | null;
} {
  return { name: values.name, note: values.note.trim() === "" ? null : values.note };
}

/** The API's `issues` (`[{ field, message }]`) for the fields a form has, by field. */
export function fieldErrorsFromIssues<F extends string>(
  issues: readonly unknown[] | undefined,
  fields: readonly F[],
): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of issues ?? []) {
    const { field, message } = (issue ?? {}) as { field?: unknown; message?: unknown };
    if (typeof field === "string" && typeof message === "string" && fields.includes(field as F)) {
      errors[field as F] = message;
    }
  }
  return errors;
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

/**
 * The place chosen, which must be one the dialog offers, or what is wrong. The note's rules are
 * shop-api's, which names the note when it is refused.
 */
export function checkMoveForm(
  values: MoveFormValues,
  active: readonly Pick<AdminStockLocation, "id">[],
):
  | { ok: true; body: { locationId: string; note: string | null } }
  | { ok: false; errors: MoveFormErrors } {
  const locationId =
    values.locationId && active.some((location) => location.id === values.locationId)
      ? values.locationId
      : null;
  if (!locationId)
    return { ok: false, errors: { locationId: "Choose where the artwork is going." } };
  return { ok: true, body: { locationId, note: values.note.trim() === "" ? null : values.note } };
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
    ...locations.map((location) => ({ value: location.id, label: location.label })),
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
