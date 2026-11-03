import type {
  AdminRegisterConflict,
  AdminRegisterEvent,
  AdminRegisterGap,
  AdminRegisterLastCheck,
} from "@auction/shop-contracts";
import { REGISTER_GAP_VALUES } from "@auction/shop-contracts";
import type { TimelineEvent } from "@auction/staff-ui";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

export const ZOHO_QUEUE_PATH = "/from-zoho";

export const ZOHO_QUEUE_TABS = ["new", "decisions", "check"] as const;
export type ZohoQueueTab = (typeof ZOHO_QUEUE_TABS)[number];

export const ZOHO_QUEUE_TAB_LABEL: Record<ZohoQueueTab, string> = {
  new: "New from Zoho",
  decisions: "Needs a decision",
  check: "Last check",
};

/** The queue's state as it appears in the page URL. Every field is optional. */
export type ZohoQueueQuery = {
  tab?: Exclude<ZohoQueueTab, "new">;
  artist?: string;
  missing?: AdminRegisterGap;
  page?: string;
};

export const GAP_LABEL: Record<AdminRegisterGap, string> = {
  image: "Image",
  size: "Size",
  medium: "Medium",
};

export const GAP_OPTIONS = REGISTER_GAP_VALUES.map((value) => ({
  value,
  label: GAP_LABEL[value],
}));

export function parseZohoQueueQuery(params: RawSearchParams): ZohoQueueQuery {
  const tab = oneOf(singleParam(params.tab), ["decisions", "check"] as const);
  const artist = singleParam(params.artist)?.slice(0, 20);
  const missing = oneOf(singleParam(params.missing), REGISTER_GAP_VALUES);
  const page = singleParam(params.page);
  return {
    ...(tab ? { tab } : {}),
    ...(artist ? { artist } : {}),
    ...(missing ? { missing } : {}),
    ...(page && /^[1-9]\d{0,3}$/.test(page) && page !== "1" ? { page } : {}),
  };
}

export function activeZohoTab(query: ZohoQueueQuery): ZohoQueueTab {
  return query.tab ?? "new";
}

export function hasActiveZohoFilters(query: ZohoQueueQuery): boolean {
  return Boolean(query.artist || query.missing);
}

/** The queue's URL with `change` applied; changing anything but the page returns to page one. */
export function zohoQueueHref(
  query: ZohoQueueQuery,
  change: { [K in keyof ZohoQueueQuery]?: ZohoQueueQuery[K] | null } = {},
): string {
  const next: Record<string, string | undefined> = { ...query };
  if (!("page" in change)) next.page = undefined;
  for (const [key, value] of Object.entries(change)) next[key] = value ?? undefined;
  return listHref(ZOHO_QUEUE_PATH, next);
}

/** The query the queue endpoints expect for this URL state. */
export function zohoQueueApiQuery(query: ZohoQueueQuery): Record<string, string> {
  const api: Record<string, string | undefined> = {
    artist: query.artist,
    missing: query.missing,
    page: query.page,
  };
  return Object.fromEntries(Object.entries(api).filter(([, value]) => Boolean(value))) as Record<
    string,
    string
  >;
}

/** "1–25 of 312" for a page of a queue. */
export function pageSummary(input: { page: number; pageSize: number; total: number }): string {
  const first = (input.page - 1) * input.pageSize + 1;
  const last = Math.min(input.page * input.pageSize, input.total);
  return `${first}–${last} of ${input.total}`;
}

/** The previous and next page links, null when there is none. */
export function pageLinks(
  query: ZohoQueueQuery,
  input: { page: number; pageSize: number; total: number },
): { prevHref: string | null; nextHref: string | null } {
  const hasNext = input.page * input.pageSize < input.total;
  return {
    prevHref:
      input.page > 1
        ? zohoQueueHref(query, { page: input.page - 1 === 1 ? null : String(input.page - 1) })
        : null,
    nextHref: hasNext ? zohoQueueHref(query, { page: String(input.page + 1) }) : null,
  };
}

/** "Still missing: image, size", or null when nothing is missing. */
export function missingSummary(missing: readonly AdminRegisterGap[]): string | null {
  if (missing.length === 0) return null;
  return `Still missing: ${missing.map((gap) => GAP_LABEL[gap].toLowerCase()).join(", ")}`;
}

// ---------------------------------------------------------------------------------------------
// Where an artwork is offered, and the fields Zoho and LAX can disagree on.

export type RegisterTone = "info" | "success" | "warning" | "danger" | "neutral";

type OfferPresentation = { label: string; tone: RegisterTone };

const OFFER_STATE: Record<string, OfferPresentation> = {
  held: { label: "Not offered yet", tone: "neutral" },
  lax_art: { label: "On lax.art", tone: "success" },
  bid_sale: { label: "In a LAX Bid sale", tone: "info" },
  private_sale: { label: "In a private sale", tone: "info" },
  sold: { label: "Sold", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "warning" },
};

export function presentOfferState(state: string): OfferPresentation {
  return OFFER_STATE[state] ?? { label: state, tone: "neutral" };
}

const KIND_LABEL: Record<string, string> = { original: "Original", print: "Print" };
export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

export const CONFLICT_FIELD_LABEL: Record<AdminRegisterConflict["field"], string> = {
  stockCode: "Stock code",
  kind: "Original or print",
  sourceOriginalId: "Made from",
  offerState: "Where it is offered",
};

/** A conflicted field as it reads in a sentence: "Zoho changed the stock code". */
const CONFLICT_FIELD_PHRASE: Record<AdminRegisterConflict["field"], string> = {
  stockCode: "the stock code",
  kind: "whether it is an original or a print",
  sourceOriginalId: "the original it was made from",
  offerState: "where it is offered",
};

const FIELD_LABEL: Record<string, string> = {
  ...CONFLICT_FIELD_LABEL,
  title: "title",
  artist: "artist",
  medium: "medium",
  dimensions: "size",
  year: "year",
  imageRefs: "images",
  catalogueStatus: "status",
};

/** Lower-case for use inside a sentence: "stock code". */
const fieldInSentence = (field: string) => (FIELD_LABEL[field] ?? field).toLowerCase();

/** A value Zoho or LAX holds for a conflicted field, as staff read it. */
export function presentConflictValue(
  field: AdminRegisterConflict["field"],
  value: string | null,
): string | null {
  if (value === null || value === "") return null;
  if (field === "kind") return kindLabel(value);
  if (field === "offerState") return presentOfferState(value).label;
  return value;
}

export const RESOLUTION_LABEL = {
  kept_lax: "Kept the LAX value",
  accepted_zoho: "Accepted the Zoho value",
} as const;

/** The CRM Product's page, from the shared CRM address template; null without one. */
export function zohoProductUrl(
  template: string | null | undefined,
  zohoProductId: string,
): string | null {
  if (!template) return null;
  return template
    .replace("{module}", encodeURIComponent("Products"))
    .replace("{recordId}", encodeURIComponent(zohoProductId));
}

// ---------------------------------------------------------------------------------------------
// The last check.

export const SYNC_MODE_LABEL = {
  dry_run: "Dry run — nothing applied",
  live: "Live",
} as const;

const SKIPPED_REASON_LABEL: Record<string, string> = {
  demo_artist: "Test artist, left out on purpose",
  invalid_modified_time: "Zoho gave no usable edit time",
  missing_title: "No title",
  missing_stock_code: "No stock code",
  invalid_stock_code: "Stock code is not in the LAX format",
  missing_artist: "No artist",
  missing_artist_code: "Artist has no code",
  duplicate_stock_code: "Stock code already belongs to another artwork",
  not_found_in_zoho: "No longer in Zoho",
  register_entry_missing: "Not in LAX yet",
};

export function skippedReasonLabel(reason: string): string {
  if (reason.startsWith("register_refused_")) return "LAX could not add it";
  return SKIPPED_REASON_LABEL[reason] ?? "Left out for another reason";
}

const NEW_ARTWORK_GAP_LABEL: Record<string, string> = {
  missing_price: "No price",
  missing_medium: "No medium",
  missing_dimensions: "No size",
  artist_code_differs_from_stock_code: "Artist code differs from the stock code",
};

export function newArtworkGapLabel(gap: string): string {
  return NEW_ARTWORK_GAP_LABEL[gap] ?? "Something else is missing";
}

type CheckRun = NonNullable<AdminRegisterLastCheck["run"]>;

export type CheckFigure = { id: string; label: string; value: string; hint?: string };

/** The headline figures of a check; what is new reads "would be added" when nothing was applied. */
export function checkFigures(run: CheckRun): CheckFigure[] {
  const dry = run.mode === "dry_run";
  return [
    { id: "total", label: "Products read", value: String(run.total) },
    {
      id: "create",
      label: dry ? "Would be added" : "Added",
      value: String(run.outcomes.create),
    },
    { id: "conflict", label: "Need a decision", value: String(run.outcomes.conflict) },
    { id: "skipped", label: "Left out", value: String(run.outcomes.skipped) },
  ];
}

/** The smaller counts, as one line: "12 updated, 300 unchanged". Empty counts are left out. */
export function checkFootnote(run: CheckRun): string | null {
  const dry = run.mode === "dry_run";
  const parts = [
    run.outcomes.update > 0
      ? `${run.outcomes.update} ${dry ? "would be updated" : "updated"}`
      : null,
    run.outcomes.unchanged > 0 ? `${run.outcomes.unchanged} unchanged` : null,
    run.outcomes.stale > 0 ? `${run.outcomes.stale} older than what LAX has` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? `${parts.join(", ")}.` : null;
}

// ---------------------------------------------------------------------------------------------
// An artwork's history.

const ACTOR_LABEL: Record<AdminRegisterEvent["actor"], string> = {
  zoho: "Zoho",
  system: "LAX",
  staff: "LAX staff",
};

function changedFields(payload: Record<string, unknown>): string[] {
  const fields = payload.fields;
  return fields && typeof fields === "object" ? Object.keys(fields) : [];
}

function stateOf(value: unknown): string {
  const state =
    value && typeof value === "object" ? (value as { state?: unknown }).state : undefined;
  return presentOfferState(typeof state === "string" ? state : "").label;
}

function conflictField(payload: Record<string, unknown>): AdminRegisterConflict["field"] | null {
  const field = payload.field;
  return typeof field === "string" && field in CONFLICT_FIELD_LABEL
    ? (field as AdminRegisterConflict["field"])
    : null;
}

function describeEvent(
  event: AdminRegisterEvent,
): Pick<TimelineEvent, "title" | "detail" | "tone"> {
  const { payload } = event;
  switch (event.type) {
    case "created":
      return {
        title: event.actor === "zoho" ? "Came in from Zoho" : "Added to the register",
        tone: "info",
      };
    case "zoho_change_applied": {
      const fields = changedFields(payload).map(fieldInSentence);
      return {
        title: fields.length > 0 ? `Updated from Zoho: ${fields.join(", ")}` : "Updated from Zoho",
      };
    }
    case "conflict_recorded": {
      const field = conflictField(payload);
      const what = field ? CONFLICT_FIELD_PHRASE[field] : "a field";
      const zoho = field
        ? presentConflictValue(
            field,
            typeof payload.zohoValue === "string" ? payload.zohoValue : null,
          )
        : null;
      return {
        title: `Zoho changed ${what}; LAX kept its own until someone decides`,
        ...(zoho ? { detail: `Zoho now has ${zoho}` } : {}),
        tone: "warning",
      };
    }
    case "conflict_resolved": {
      const field = conflictField(payload);
      const what = field ? CONFLICT_FIELD_PHRASE[field] : "a field";
      return {
        title:
          payload.resolution === "accepted_zoho"
            ? `Accepted the Zoho value for ${what}`
            : `Kept the LAX value for ${what}`,
        tone: "success",
      };
    }
    case "offer_moved":
      return { title: `Moved from ${stateOf(payload.from)} to ${stateOf(payload.to)}` };
    default:
      return { title: "Changed" };
  }
}

/** The register's history as the shared timeline reads it. */
export function buildRegisterTimeline(events: readonly AdminRegisterEvent[]): TimelineEvent[] {
  return events.map((event) => ({
    id: event.id,
    at: event.createdAt,
    actor: ACTOR_LABEL[event.actor],
    ...describeEvent(event),
  }));
}

// ---------------------------------------------------------------------------------------------
// Deciding a conflict.

export type ConflictDecision = keyof typeof RESOLUTION_LABEL;

export const KEEP_LAX_LABEL = "Keep LAX value";
export const ACCEPT_ZOHO_LABEL = "Accept Zoho value";

/**
 * The words of the confirmation for one decision. A decision is recorded in the artwork's
 * history; it does not rewrite the field, so the copy says exactly that.
 */
export function conflictDecisionCopy(
  conflict: Pick<AdminRegisterConflict, "field" | "zohoValue" | "laxValue">,
  decision: ConflictDecision,
): { title: string; description: string; confirmLabel: string; success: string } {
  const what = CONFLICT_FIELD_PHRASE[conflict.field];
  const zoho = presentConflictValue(conflict.field, conflict.zohoValue) ?? "nothing";
  const lax = presentConflictValue(conflict.field, conflict.laxValue) ?? "nothing";
  if (decision === "kept_lax") {
    return {
      title: `Keep the LAX value for ${what}?`,
      description: `LAX keeps ${lax}. Zoho still has ${zoho}, so change it there as well if LAX is right. The decision is added to the artwork's history.`,
      confirmLabel: KEEP_LAX_LABEL,
      success: RESOLUTION_LABEL.kept_lax,
    };
  }
  return {
    title: `Accept the Zoho value for ${what}?`,
    description: `This records that Zoho is right, with ${zoho}. The decision is added to the artwork's history. It does not change what LAX holds for ${what}.`,
    confirmLabel: ACCEPT_ZOHO_LABEL,
    success: RESOLUTION_LABEL.accepted_zoho,
  };
}
