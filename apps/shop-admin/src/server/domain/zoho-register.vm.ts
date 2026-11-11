import type {
  AdminRegisterConflict,
  AdminRegisterDetail,
  AdminRegisterEvent,
  AdminRegisterGap,
  AdminRegisterLastCheck,
  AdminRegisterPlace,
  AdminSoldAttentionItem,
} from "@auction/shop-contracts";
import { REGISTER_GAP_VALUES, REGISTER_PLACE_VALUES } from "@auction/shop-contracts";
import type { TimelineEvent } from "@auction/staff-ui";
import { bidLotUrl } from "../../lib/offer-at-auction-links";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

export const ZOHO_QUEUE_PATH = "/from-zoho";

export const ZOHO_QUEUE_TABS = ["new", "decisions", "all", "link", "check"] as const;
export type ZohoQueueTab = (typeof ZOHO_QUEUE_TABS)[number];

export const ZOHO_QUEUE_TAB_LABEL: Record<ZohoQueueTab, string> = {
  new: "New from Zoho",
  decisions: "Needs a decision",
  all: "All artworks",
  link: "Link lax.art",
  check: "Last check",
};

/** The queue's state as it appears in the page URL. Every field is optional. */
export type ZohoQueueQuery = {
  tab?: Exclude<ZohoQueueTab, "new">;
  artist?: string;
  missing?: AdminRegisterGap;
  /** All artworks: where the artwork is. */
  place?: AdminRegisterPlace;
  page?: string;
  /** Link lax.art: the part of the report shown (Matched when absent). */
  view?: Exclude<ZohoLinkView, "matched">;
  /** Link lax.art: words in the title, artist or stock code. */
  q?: string;
  /** Link lax.art: only rows matched by this rule. */
  matched?: ZohoLinkRule;
  /** Link lax.art: only live or only draft listings. */
  on?: "live" | "draft";
  /** Link lax.art: the order of the rows (by title when absent). */
  sort?: "artist";
};

export const ZOHO_LINK_VIEWS = ["matched", "choice", "none", "linked"] as const;
export type ZohoLinkView = (typeof ZOHO_LINK_VIEWS)[number];
export const ZOHO_LINK_RULES = [
  "stock_code",
  "artist_and_title",
  "artist_title_and_size",
  "artist_title_and_year",
] as const;
export type ZohoLinkRule = (typeof ZOHO_LINK_RULES)[number];

export const ZOHO_LINK_SEARCH_MAX = 100;

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
  const tab = oneOf(singleParam(params.tab), ["decisions", "all", "link", "check"] as const);
  const artist = singleParam(params.artist)?.slice(0, 80);
  const view = oneOf(singleParam(params.view), ["choice", "none", "linked"] as const);
  const q = singleParam(params.q)?.trim().slice(0, ZOHO_LINK_SEARCH_MAX);
  const matched = oneOf(singleParam(params.matched), ZOHO_LINK_RULES);
  const on = oneOf(singleParam(params.on), ["live", "draft"] as const);
  const sort = oneOf(singleParam(params.sort), ["artist"] as const);
  const missing = oneOf(singleParam(params.missing), REGISTER_GAP_VALUES);
  const place = oneOf(singleParam(params.place), REGISTER_PLACE_VALUES);
  const page = singleParam(params.page);
  return {
    ...(tab ? { tab } : {}),
    ...(artist ? { artist } : {}),
    ...(missing ? { missing } : {}),
    ...(place ? { place } : {}),
    ...(view ? { view } : {}),
    ...(q ? { q } : {}),
    ...(matched ? { matched } : {}),
    ...(on ? { on } : {}),
    ...(sort ? { sort } : {}),
    ...(page && /^[1-9]\d{0,3}$/.test(page) && page !== "1" ? { page } : {}),
  };
}

export function activeZohoTab(query: ZohoQueueQuery): ZohoQueueTab {
  return query.tab ?? "new";
}

export function hasActiveZohoFilters(query: ZohoQueueQuery): boolean {
  // "Missing" belongs to New from Zoho; the other tabs have no chip for it.
  return Boolean(query.artist || query.place || (activeZohoTab(query) === "new" && query.missing));
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
    place: query.place,
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
  held: { label: "Not offered", tone: "neutral" },
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

/**
 * The CRM record's page, from the shared CRM address template; null without one. An original is a
 * Product; a print group is a Print_Products record, so its link opens that module.
 */
export function zohoProductUrl(
  template: string | null | undefined,
  zohoProductId: string,
  module: "Products" | "Print_Products" = "Products",
): string | null {
  if (!template) return null;
  return template
    .replace("{module}", encodeURIComponent(module))
    .replace("{recordId}", encodeURIComponent(zohoProductId));
}

/**
 * Where an action on a "Zoho says Sold, but this artwork is still for sale" item goes: the
 * place the artwork is withdrawn from, or its Zoho record. Null when the place has no page to
 * link to, so the action is left out rather than sent nowhere. "It is not sold" is not a link.
 */
export function soldAttentionActionHref(
  item: Pick<AdminSoldAttentionItem, "place" | "placeRefId" | "zohoProductId">,
  action: AdminSoldAttentionItem["actions"][number]["kind"],
  links: { bidAdminUrl: string | null; zohoUrlTemplate: string | null },
): { href: string; external: boolean } | null {
  switch (action) {
    case "unpublish_lax_art":
      return item.placeRefId ? { href: `/artworks/${item.placeRefId}`, external: false } : null;
    case "withdraw_lot":
    case "withdraw_offer": {
      if (item.place === "private_sale" || !item.placeRefId) return null;
      const href = bidLotUrl(links.bidAdminUrl, item.placeRefId);
      return href ? { href, external: true } : null;
    }
    case "open_in_zoho": {
      const href = zohoProductUrl(links.zohoUrlTemplate, item.zohoProductId);
      return href ? { href, external: true } : null;
    }
    case "not_sold":
      return null;
  }
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
  invalid_stock_code:
    "Stock code is not in the LAX format: LAX-ORI or LAX-PRT, artist, collection, year, number",
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
  non_standard_code_parts:
    "Artist code should be 2 to 3 letters and collection code 2 to 4 letters or digits",
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
// The LAX listing LAX keeps on each Zoho Product.

type ListingRun = NonNullable<AdminRegisterLastCheck["listing"]["run"]>;

/** The headline figures of a listing pass; a dry run says what it would have corrected. */
export function listingFigures(run: ListingRun): CheckFigure[] {
  const dry = run.mode === "dry_run";
  return [
    { id: "checked", label: "Artworks checked", value: String(run.checked) },
    {
      id: "changed",
      label: dry ? "Would be corrected" : "Corrected",
      value: String(run.changed),
    },
    { id: "unchanged", label: "Already right", value: String(run.unchanged) },
    { id: "failed", label: "Not written", value: String(run.failed) },
  ];
}

const LISTING_FAILURE_LABEL: Record<string, string> = {
  product_not_found: "No longer in Zoho",
  INVALID_DATA: "Zoho refused the value",
  NO_PERMISSION: "The LAX integration may not write these fields",
  OAUTH_SCOPE_MISMATCH: "The LAX integration may not write these fields",
  TOO_MANY_REQUESTS: "Zoho was busy",
  lax_art_unavailable: "lax.art could not be reached",
  lax_art_refused: "lax.art refused the request",
};

export function listingFailureLabel(code: string): string {
  return LISTING_FAILURE_LABEL[code] ?? "Zoho did not accept it";
}

/** The writes that stopped after their retries, as one line; null when there are none. */
export function failedDeliveriesNote(count: number): string | null {
  if (count === 0) return null;
  const updates = count === 1 ? "1 update to Zoho" : `${count} updates to Zoho`;
  const they = count === 1 ? "It is" : "They are";
  return `${updates} stopped after ${count === 1 ? "its" : "their"} retries. ${they} waiting in Failed jobs in LAX Bid admin.`;
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

/** "Changed from A to B" when a decision rewrote a value. */
function appliedDetail(payload: Record<string, unknown>): { detail?: string } {
  const applied = payload.applied;
  if (!applied || typeof applied !== "object") return {};
  const { from, to } = applied as { from?: unknown; to?: unknown };
  return typeof from === "string" && typeof to === "string" && from !== to
    ? { detail: `Changed from ${from} to ${to}` }
    : {};
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
        ...appliedDetail(payload),
        tone: "success",
      };
    }
    case "offer_moved":
      return { title: `Moved from ${stateOf(payload.from)} to ${stateOf(payload.to)}` };
    case "lax_art_draft_created":
      return { title: "lax.art draft created", tone: "success" };
    case "zoho_link_linked":
      return {
        title: "Linked to a lax.art artwork",
        ...(typeof payload.slug === "string" ? { detail: `lax.art/${payload.slug}` } : {}),
        tone: "success",
      };
    case "zoho_link_unlinked":
      return {
        title: "Link to the lax.art artwork removed",
        ...(typeof payload.reason === "string" ? { detail: `Reason: ${payload.reason}` } : {}),
        tone: "warning",
      };
    case "move_confirmed":
      return describeMove(payload);
    case "zoho_writeback_recorded":
      return describeWriteback(payload);
    default:
      return { title: "Something changed" };
  }
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

/** A draft lot made for an offer at auction, or a return to lax.art; the actor says who confirmed. */
function describeMove(
  payload: Record<string, unknown>,
): Pick<TimelineEvent, "title" | "detail" | "tone"> {
  if (payload.direction === "to_lax_art") {
    return {
      title: "Returned to lax.art as a draft",
      detail: "From a LAX Bid lot",
      tone: "success",
    };
  }
  const parts = [
    payload.consignorAgreed === true ? "Consignor agreement confirmed" : null,
    text(payload.saleTitle),
    payload.withdrawnFromLaxArt === true ? "Taken off lax.art" : null,
  ].filter((part): part is string => part !== null);
  return {
    title: "Draft lot created",
    ...(parts.length > 0 ? { detail: parts.join(" · ") } : {}),
    tone: "success",
  };
}

/** LAX set Zoho's Status after an offer or a sale in LAX. */
function describeWriteback(
  payload: Record<string, unknown>,
): Pick<TimelineEvent, "title" | "detail"> {
  const to = text(payload.to);
  return {
    title: "Status set in Zoho",
    ...(to ? { detail: `Zoho Status is now ${to}` } : {}),
  };
}

/** The register's history as the shared timeline reads it. */
export function buildRegisterTimeline(events: readonly AdminRegisterEvent[]): TimelineEvent[] {
  return events.map((event) => ({
    id: event.id,
    at: event.createdAt,
    actor: event.actorName ?? ACTOR_LABEL[event.actor],
    ...describeEvent(event),
  }));
}

// ---------------------------------------------------------------------------------------------
// Deciding a conflict.

export type ConflictDecision = keyof typeof RESOLUTION_LABEL;

export const KEEP_LAX_LABEL = "Keep LAX value";
export const ACCEPT_ZOHO_LABEL = "Accept Zoho value";

/**
 * The words of the confirmation for one decision. Keeping LAX's value sends it back to Zoho (the
 * write-back does that); accepting Zoho's value applies it in LAX straight away.
 */
export function conflictDecisionCopy(
  conflict: Pick<AdminRegisterConflict, "field" | "zohoValue" | "laxValue">,
  decision: ConflictDecision,
): { title: string; description: string; confirmLabel: string; success: string } {
  const what = CONFLICT_FIELD_PHRASE[conflict.field];
  const zoho = presentConflictValue(conflict.field, conflict.zohoValue) ?? "nothing";
  const lax = presentConflictValue(conflict.field, conflict.laxValue);
  if (decision === "kept_lax") {
    return {
      title: `Keep the LAX value for ${what}?`,
      description: lax
        ? `LAX keeps ${lax}. LAX will set Zoho back to ${lax}. The decision is added to the artwork's history.`
        : "LAX keeps it empty. LAX will clear it in Zoho. The decision is added to the artwork's history.",
      confirmLabel: KEEP_LAX_LABEL,
      success: RESOLUTION_LABEL.kept_lax,
    };
  }
  return {
    title: `Accept the Zoho value for ${what}?`,
    description: `LAX changes ${what} to ${zoho} straight away, and the decision is added to the artwork's history. If another artwork already uses ${zoho}, nothing changes and you will be told.`,
    confirmLabel: ACCEPT_ZOHO_LABEL,
    success: RESOLUTION_LABEL.accepted_zoho,
  };
}

/** The one line under a comparison where Zoho's value cannot be taken over. */
export function setInLaxLine(conflict: Pick<AdminRegisterConflict, "field" | "laxValue">): string {
  const label = CONFLICT_FIELD_LABEL[conflict.field];
  const lax = presentConflictValue(conflict.field, conflict.laxValue);
  return lax
    ? `${label} is set in LAX. LAX will set Zoho back to ${lax}.`
    : `${label} is set in LAX. LAX will clear it in Zoho.`;
}

// ---------------------------------------------------------------------------------------------
// Offering an artwork on lax.art.

export const LAX_ART_ARTWORK_PATH = "/artworks";

export type LaxArtOfferAvailability =
  /** A print: prints are sold in runs on LAX Shop, so no offer is drawn at all. */
  | { kind: "hidden" }
  /** The record already has a lax.art listing: open it. */
  | { kind: "open"; href: string }
  /** Staff can offer it now. */
  | { kind: "offer" }
  /** The register or Zoho holds it; the action stays, disabled, and says why. */
  | { kind: "blocked"; reason: string };

/** What the record's "Offer on lax.art…" action does for this artwork. */
export function laxArtOfferAvailability(
  detail: Pick<AdminRegisterDetail, "kind" | "laxArt" | "offerBlockers">,
): LaxArtOfferAvailability {
  if (detail.kind !== "original") return { kind: "hidden" };
  if (detail.laxArt) {
    return { kind: "open", href: `${LAX_ART_ARTWORK_PATH}/${detail.laxArt.artworkId}` };
  }
  if (detail.offerBlockers.length > 0) {
    return { kind: "blocked", reason: detail.offerBlockers.map((b) => b.message).join(" ") };
  }
  return { kind: "offer" };
}

// ---------------------------------------------------------------------------------------------
// Offering an artwork at auction.

export type AuctionOfferAvailability =
  /** A print: prints are sold in runs on LAX Shop, so no offer is drawn at all. */
  | { kind: "hidden" }
  /** Staff can offer it now. */
  | { kind: "offer" }
  /** A reason is in the way; the action stays, disabled, and says why. */
  | { kind: "blocked"; reason: string };

/** What the record's "Offer at auction…" action does for this artwork. */
export function auctionOfferAvailability(
  detail: Pick<AdminRegisterDetail, "kind" | "auctionBlockers" | "whereItIs">,
): AuctionOfferAvailability {
  if (detail.kind !== "original") return { kind: "hidden" };
  if (detail.whereItIs.key === "draft_bid_lot") {
    return {
      kind: "blocked",
      reason: "A draft lot is already in LAX Bid. Open it there to finish and publish it.",
    };
  }
  if (detail.auctionBlockers.length > 0) {
    return { kind: "blocked", reason: detail.auctionBlockers.map((b) => b.message).join(" ") };
  }
  return { kind: "offer" };
}
