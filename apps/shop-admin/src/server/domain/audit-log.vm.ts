import type { AdminAuditEntry } from "@auction/shop-contracts";
import { formatStaffDateTime, formatStaffMoney, humanizeStatus } from "@auction/staff-ui";
import { staffRoleLabel } from "./staff-role-label.vm";

/*
 * How an audit event reads in LAX Admin: what happened in words, who did it (a person by name,
 * or the platform), which record it touched with a link when that record has a page, and what
 * the event recorded, as labelled facts. No event code, record kind or id is shown raw; ids are
 * copyable facts in the event's panel.
 */

const ACTION_LABELS: Record<string, string> = {
  // Orders and money
  request_refund: "Refund requested",
  "refund.request": "Refund requested",
  full_refund_edition_reversal: "Edition returned after a full refund",
  cancel_after_possession: "Order cancelled after delivery",
  mark_payout_paid: "Payout marked paid",
  "payout.mark_paid": "Payout marked paid",
  connect_transfer_payout: "Payout sent by transfer",
  set_artwork_price: "Edition price changed",
  approve_sale_fee: "Sale fee approved",
  // Fulfilment and production
  update_fulfilment: "Fulfilment updated",
  record_possession: "Possession recorded",
  create_production_task: "Production task created",
  "production.update_task": "Production task updated",
  // Sales
  create_hold: "Stock hold created",
  create_hold_override: "Stock hold created over the limit",
  release_hold: "Stock hold released",
  expire_hold: "Stock hold expired",
  record_third_party_sale: "Third-party sale recorded",
  grant_sale_authority: "Sale authority granted",
  reject_sale_authority_request: "Sale limit request declined",
  // Catalogue
  create_artist: "Artist created",
  archive_artist: "Artist archived",
  restore_artist: "Artist restored",
  link_artist_identity: "Artist linked to a LAX account",
  unlink_artist_identity: "Artist unlinked from their LAX account",
  create_artwork: "Artwork created",
  update_artwork: "Artwork updated",
  publish_artwork: "Artwork published",
  unpublish_artwork: "Artwork unpublished",
  archive_artwork: "Artwork archived",
  restore_artwork: "Artwork restored",
  publish: "Published",
  unpublish: "Unpublished",
  archive: "Archived",
  create_merchandise_product: "Merchandise created",
  update_merchandise_product: "Merchandise updated",
  archive_merchandise_product: "Merchandise archived",
  restore_merchandise_product: "Merchandise restored",
  add_merchandise_variant: "Merchandise variant added",
  update_merchandise_variant: "Merchandise variant updated",
  archive_merchandise_variant: "Merchandise variant archived",
  restore_merchandise_variant: "Merchandise variant restored",
  adjust_merchandise_stock: "Merchandise stock adjusted",
  // Enquiries
  "enquiry.update": "Enquiry updated",
  "enquiry.note.add": "Note added to an enquiry",
  // Staff
  staff_grant_create: "Staff access granted",
  staff_grant_update: "Staff role changed",
  staff_grant_revoke: "Staff access removed",
  // Editorial and help
  "editorial.preview_token.issue": "Preview link created",
  "editorial.placement.replace": "Home page placements changed",
  "home_features.replace": "Featured on home changed",
  "editorial.exhibition.links.replace": "Exhibition links changed",
  "editorial.story.links.replace": "Story links changed",
};

const EDITORIAL_NOUNS: Record<string, string> = {
  exhibition: "Exhibition",
  story: "Story",
  page: "Page",
  venue: "Venue",
};

const HELP_NOUNS: Record<string, string> = { article: "Help question", category: "Help category" };

const VERBS: Record<string, string> = {
  create: "created",
  update: "updated",
  publish: "published",
  unpublish: "unpublished",
  delete: "deleted",
  reorder: "reordered",
};

/** "Payout marked paid", "Story published"; an unmapped code reads as words, never raw. */
export function auditActionLabel(action: string): string {
  const mapped = ACTION_LABELS[action];
  if (mapped) return mapped;
  const [area, noun, verb] = action.split(".");
  const nouns = area === "editorial" ? EDITORIAL_NOUNS : area === "help" ? HELP_NOUNS : null;
  if (nouns && noun && verb && nouns[noun] && VERBS[verb]) return `${nouns[noun]} ${VERBS[verb]}`;
  return humanizeStatus(action.replaceAll(".", "_"));
}

const RECORD_LABELS: Record<string, string> = {
  shop_artist: "Artist",
  shop_artwork: "Artwork",
  shop_edition: "Edition",
  shop_fulfilment: "Fulfilment",
  shop_general_enquiry: "General enquiry",
  shop_artwork_interest: "Artwork enquiry",
  shop_payout_ledger: "Payout",
  shop_product: "Merchandise",
  shop_product_variant: "Merchandise variant",
  shop_production_task: "Production task",
  shop_refund: "Refund",
  shop_return: "Return",
  shop_sale_authority_request: "Sale limit request",
  shop_sale_fee: "Sale fee",
  shop_staff_member: "Staff member",
  shop_stock_hold: "Stock hold",
  shop_third_party_sale: "Third-party sale",
  editorial_exhibition: "Exhibition",
  editorial_story: "Story",
  editorial_page: "Page",
  editorial_venue: "Venue",
  editorial_placement: "Home page placement",
  shop_home_placement: "Featured on home list",
  help_article: "Help question",
  help_category: "Help category",
};

/** The kind of record an event touched, in words. */
export function auditRecordLabel(targetType: string): string {
  return RECORD_LABELS[targetType] ?? humanizeStatus(targetType.replace(/^shop_/, ""));
}

const EDITORIAL_PATHS: Record<string, string> = {
  editorial_exhibition: "exhibitions",
  editorial_story: "stories",
  editorial_page: "pages",
  editorial_venue: "venues",
};

/** The record's page or list panel in LAX Admin, when it has one. */
export function auditRecordHref(targetType: string, targetId: string): string | null {
  const id = encodeURIComponent(targetId);
  switch (targetType) {
    case "shop_artist":
      return `/artists/${id}`;
    case "shop_artwork":
      return `/artworks/${id}`;
    case "shop_product":
      return `/merchandise/${id}`;
    case "shop_production_task":
      return `/production/${id}`;
    case "shop_general_enquiry":
      return `/enquiries/general/${id}`;
    case "shop_artwork_interest":
      return `/enquiries/artwork/${id}`;
    case "help_article":
      return `/help/${id}`;
    case "shop_staff_member":
      return `/staff?staff=${id}`;
    case "shop_payout_ledger":
      return `/payouts?payout=${id}`;
    case "shop_stock_hold":
      return `/holds?hold=${id}`;
    case "shop_third_party_sale":
      return `/third-party-sales?sale=${id}`;
    case "shop_sale_authority_request":
      return `/requests?view=all&request=${id}`;
    default: {
      const kind = EDITORIAL_PATHS[targetType];
      return kind ? `/editorial/${kind}/${id}` : null;
    }
  }
}

export type AuditActor = { name: string; email: string | null; kind: "person" | "system" };

const SYSTEM_ACTORS: Record<string, string> = {
  "system:shop-scheduler": "LAX scheduler",
  "system:stripe-webhook": "Payment provider",
};

/** Who acted: a person by their profile name, or the platform itself, never a raw subject. */
export function auditActor(entry: {
  actorSubjectId: string;
  actorName?: string | null;
  actorEmail?: string | null;
}): AuditActor {
  if (entry.actorSubjectId.startsWith("system:")) {
    return { name: SYSTEM_ACTORS[entry.actorSubjectId] ?? "System", email: null, kind: "system" };
  }
  const email = entry.actorEmail ?? null;
  return { name: entry.actorName ?? email ?? "Unknown staff member", email, kind: "person" };
}

export type AuditFact = { label: string; value: string; copyValue?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/** A status or kind such as "due" or "pending_refund_period", which reads as words. */
const CODE = /^[a-z]+(_[a-z]+)*$/;

function factLabel(key: string): string {
  const words = key
    .replace(/(Pence|Json)$/, "")
    .replace(/Id$/, " ID")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim()
    .toLowerCase();
  const label = words.replace(/\bid\b/, "ID");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function factValue(key: string, value: unknown): AuditFact | null {
  const label = factLabel(key);
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return { label, value: value ? "Yes" : "No" };
  if (typeof value === "number") {
    return { label, value: /Pence$/.test(key) ? formatStaffMoney(value) : String(value) };
  }
  if (typeof value !== "string") return null;
  if (key === "role") return { label, value: staffRoleLabel(value) };
  if (UUID.test(value) || key.endsWith("Id")) {
    const idLabel = key.endsWith("SubjectId")
      ? "LAX account ID"
      : label.endsWith("ID")
        ? label
        : `${label} ID`;
    return { label: idLabel, value, copyValue: value };
  }
  if (ISO_TIME.test(value)) {
    return { label, value: formatStaffDateTime(value, { zoneLabel: true }) };
  }
  if (CODE.test(value)) return { label, value: humanizeStatus(value) };
  return { label, value };
}

export type AuditChange = { label: string; before: string; after: string };

/**
 * What the event recorded: the fields that changed, before and after, and the rest of the
 * recorded state as facts. Ids stay out of the sentence and are offered to copy.
 */
export function auditDetail(entry: Pick<AdminAuditEntry, "before" | "after">): {
  changes: AuditChange[];
  facts: AuditFact[];
} {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const changes: AuditChange[] = [];
  const facts: AuditFact[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = factValue(key, before[key]);
    const now = factValue(key, after[key]);
    const changed = key in before && JSON.stringify(before[key]) !== JSON.stringify(after[key]);
    if (changed && !was?.copyValue && !now?.copyValue) {
      changes.push({
        label: factLabel(key),
        before: was?.value ?? "None",
        after: now?.value ?? "None",
      });
    } else if (now) {
      facts.push(now);
    }
  }
  return { changes, facts };
}
