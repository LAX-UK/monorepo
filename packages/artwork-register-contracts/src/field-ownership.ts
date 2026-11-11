import type { ArtworkRegisterEntry } from "./entry.js";

/**
 * Each piece of information has one owner; the owner's value always wins and the other system
 * shows a copy. Zoho owns the catalogue and back office; LAX owns where a piece is sold.
 *
 * The stock code is LAX-owned: LAX issues every number (Zoho never does), so a stock code edited
 * in Zoho is a conflict for staff to look at, never a silent change of identity.
 */
export const FIELD_OWNERS = {
  title: "zoho",
  artist: "zoho",
  medium: "zoho",
  dimensions: "zoho",
  year: "zoho",
  imageRefs: "zoho",
  catalogueStatus: "zoho",
  stockCode: "lax",
  kind: "lax",
  sourceOriginalId: "lax",
  offerState: "lax",
} as const;

export type RegisterField = keyof typeof FIELD_OWNERS;
export type FieldOwner = (typeof FIELD_OWNERS)[RegisterField];

export const REGISTER_FIELDS = Object.keys(FIELD_OWNERS) as RegisterField[];

type FieldsOwnedBy<O extends FieldOwner> = {
  [F in RegisterField]: (typeof FIELD_OWNERS)[F] extends O ? F : never;
}[RegisterField];

export type ZohoOwnedField = FieldsOwnedBy<"zoho">;
export type LaxOwnedField = FieldsOwnedBy<"lax">;

export const ZOHO_OWNED_FIELDS = REGISTER_FIELDS.filter(
  (field): field is ZohoOwnedField => FIELD_OWNERS[field] === "zoho",
);
export const LAX_OWNED_FIELDS = REGISTER_FIELDS.filter(
  (field): field is LaxOwnedField => FIELD_OWNERS[field] === "lax",
);

export function ownerOf(field: RegisterField): FieldOwner {
  return FIELD_OWNERS[field];
}

/** The value of each register field as a plain, comparable value. */
export type RegisterFieldValues = {
  title: ArtworkRegisterEntry["title"];
  artist: ArtworkRegisterEntry["artist"];
  medium: ArtworkRegisterEntry["medium"];
  dimensions: ArtworkRegisterEntry["dimensions"];
  year: ArtworkRegisterEntry["year"];
  imageRefs: ArtworkRegisterEntry["imageRefs"];
  catalogueStatus: ArtworkRegisterEntry["catalogueStatus"];
  stockCode: ArtworkRegisterEntry["stockCode"];
  kind: ArtworkRegisterEntry["kind"];
  sourceOriginalId: ArtworkRegisterEntry["sourceOriginalId"];
  /** The state alone: Zoho sees where a piece is offered, not the product-side reference. */
  offerState: ArtworkRegisterEntry["offer"]["state"];
};

export function registerFieldValue<F extends RegisterField>(
  entry: ArtworkRegisterEntry,
  field: F,
): RegisterFieldValues[F] {
  const values: RegisterFieldValues = {
    title: entry.title,
    artist: entry.artist,
    medium: entry.medium,
    dimensions: entry.dimensions,
    year: entry.year,
    imageRefs: entry.imageRefs,
    catalogueStatus: entry.catalogueStatus,
    stockCode: entry.stockCode,
    kind: entry.kind,
    sourceOriginalId: entry.sourceOriginalId,
    offerState: entry.offer.state,
  };
  return values[field];
}

/**
 * A change reported by Zoho for one Product: the fields that changed, already mapped to register
 * fields, and the time Zoho recorded the change.
 */
export type ZohoChange = {
  zohoProductId: string;
  modifiedAt: Date;
  fields: Partial<RegisterFieldValues>;
};

/**
 * What a conflict can be about: a LAX-owned field Zoho changed, or the Status LAX would have
 * written over a value staff set in Zoho. The Status is Zoho's to hold, so it is never applied
 * from Zoho or forced from LAX; staff see both sides.
 */
export type RegisterConflictField = LaxOwnedField | "catalogueStatus";

export type FieldConflict = {
  field: LaxOwnedField;
  zohoValue: unknown;
  laxValue: unknown;
};

export type ReconcileResult = {
  /** Zoho-owned fields whose value differs, to be applied. */
  apply: Partial<Pick<RegisterFieldValues, ZohoOwnedField>>;
  /** LAX-owned fields Zoho changed. Never applied; staff decide. */
  conflicts: FieldConflict[];
  /** True when the entry already holds a newer or equal change from Zoho: nothing to do. */
  stale: boolean;
};

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => key in right && sameValue(left[key], right[key]));
}

/**
 * Decides what to do with a change from Zoho. Zoho-owned fields that differ are applied; a
 * LAX-owned field that differs becomes a conflict and is never applied; values that already
 * match are skipped, and a change no newer than the last one applied is ignored, so a notice that
 * arrives twice, or late, changes nothing.
 */
export function reconcileZohoChange(
  entry: ArtworkRegisterEntry,
  change: ZohoChange,
): ReconcileResult {
  if (entry.zohoModifiedAt && change.modifiedAt.getTime() <= entry.zohoModifiedAt.getTime()) {
    return { apply: {}, conflicts: [], stale: true };
  }

  const apply: Record<string, unknown> = {};
  const conflicts: FieldConflict[] = [];

  for (const field of REGISTER_FIELDS) {
    if (!(field in change.fields)) continue;
    const incoming = change.fields[field];
    if (incoming === undefined) continue;
    const current = registerFieldValue(entry, field);
    if (sameValue(incoming, current)) continue;

    if (FIELD_OWNERS[field] === "zoho") {
      apply[field] = incoming;
    } else {
      conflicts.push({ field: field as LaxOwnedField, zohoValue: incoming, laxValue: current });
    }
  }

  return {
    apply: apply as ReconcileResult["apply"],
    conflicts,
    stale: false,
  };
}

/**
 * The LAX-owned fields where Zoho's value can be taken over. The stock code is a plain value LAX
 * can change; where an artwork is offered, and the identity facts behind it, are set in LAX only,
 * so the answer there is always to keep LAX's value and send it back to Zoho. A Status conflict is
 * never accepted: Zoho's Status already stands, and LAX does not force its own over it.
 */
export const ZOHO_ACCEPTABLE_FIELDS = ["stockCode"] as const satisfies readonly LaxOwnedField[];

export function canAcceptZohoValue(field: RegisterConflictField): boolean {
  return (ZOHO_ACCEPTABLE_FIELDS as readonly RegisterConflictField[]).includes(field);
}
