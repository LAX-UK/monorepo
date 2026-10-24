import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { AdminAuditLogRow } from "@/lib/data/http/admin-audit.schema";
import { formatStaffDateTime } from "@auction/staff-ui";
import type { StaffStatusTone } from "@auction/staff-ui";
import {
  type AuditEventDetail,
  buildAuditEventDetail,
  humanizeKey,
  summariseAuditEvent,
} from "./audit-event-detail";

export type AuditActorDisplay = {
  /** "Ada Staff", "A client", "System". */
  name: string;
  /** Shown beneath the name when known. */
  email: string | null;
  kind: "staff" | "client" | "system";
};

export type AuditEntity = {
  typeLabel: string;
  type: string;
  id: string;
  /** First eight characters of the id, for text that must stay short. */
  shortId: string;
  /** The page for this record, when the viewer can open one. */
  href: string | null;
};

/** One audit event as the list and the detail panel show it; plain data for the client. */
export type AuditLogRowModel = {
  id: string;
  /** ISO timestamp. */
  at: string;
  actor: AuditActorDisplay;
  actorUserId: string | null;
  action: string;
  actionCode: string;
  tone: StaffStatusTone;
  entity: AuditEntity;
  summary: string;
  detail: AuditEventDetail;
};

const ENTITY_LABELS: Record<string, string> = {
  lot: "Lot",
  sale: "Sale",
  user: "Account",
  auth: "Account security",
  payment: "Payment",
  payout: "Payout",
  legal_entity: "Legal entity",
  source_of_funds: "Source of Funds case",
  aml_screening: "AML screening",
  artist: "Artist",
  venue: "Venue",
  category: "Category",
  bid: "Bid",
  submission: "Submission",
  item_submission: "Submission",
  telephone_bid_booking: "Telephone booking",
  data_export: "Export",
  platform: "Platform",
  shop_order: "Shop order",
  shop_order_line: "Shop order line",
  shop_artwork: "Shop artwork",
  shop_edition: "Shop edition",
  shop_refund: "Shop refund",
  shop_fulfilment: "Shop fulfilment",
  shop_dispute: "Shop dispute",
  shop_payout_ledger: "Shop payout",
  shop_stock_hold: "Shop stock hold",
  shop_return: "Shop return",
  shop_production_task: "Shop production task",
  shop_original_sale: "Shop original sale",
};

/** Entity types offered as a filter, in the order staff look for them. */
export const AUDIT_ENTITY_TYPES = [
  "lot",
  "sale",
  "payment",
  "payout",
  "user",
  "legal_entity",
  "source_of_funds",
  "aml_screening",
  "artist",
  "venue",
  "category",
  "bid",
  "item_submission",
  "telephone_bid_booking",
] as const;

export function auditEntityTypeLabel(type: string): string {
  return ENTITY_LABELS[type] ?? humanizeKey(type);
}

/** Pages that exist for an entity, and whether the finance shell may open them. */
const ENTITY_ROUTES: Record<
  string,
  { path: (id: string) => string; finance: boolean } | undefined
> = {
  lot: { path: (id) => `/admin/lots/${id}`, finance: false },
  sale: { path: (id) => `/admin/sales/${id}`, finance: false },
  user: { path: (id) => `/admin/clients/${id}`, finance: false },
  legal_entity: { path: (id) => `/admin/legal-entities/${id}`, finance: false },
  artist: { path: (id) => `/admin/artists/${id}`, finance: false },
  venue: { path: (id) => `/admin/venues/${id}`, finance: false },
  category: { path: (id) => `/admin/categories/${id}`, finance: false },
  item_submission: { path: (id) => `/admin/submissions/${id}`, finance: false },
  submission: { path: (id) => `/admin/submissions/${id}`, finance: false },
  source_of_funds: {
    path: (id) => `/admin/compliance/source-of-funds/${id}`,
    finance: false,
  },
};

export function auditEntityHref(
  type: string,
  id: string,
  viewer: { canOpenPlatformRoutes: boolean },
): string | null {
  const route = ENTITY_ROUTES[type];
  if (!route) return null;
  if (!route.finance && !viewer.canOpenPlatformRoutes) return null;
  return route.path(encodeURIComponent(id));
}

const DANGER =
  /(failed|blocked|declined|rejected|suspended|revoked|cancelled|reversed|deleted|disabled|clawback|dispute_opened|match_flagged|restricted|voided)/;
const SUCCESS =
  /(approved|completed|paid|published|captured|verified|fulfilled|granted|released|activated|created|registered)/;
const WARNING = /(requested|required|review|started|reset|impersonation|downloaded|changed|merged)/;

/** The tone of an action: what went wrong, what went through, what needs attention. */
export function auditActionTone(eventType: string): StaffStatusTone {
  const verb = eventType.split(".").slice(1).join(".") || eventType;
  if (DANGER.test(verb)) return "danger";
  if (SUCCESS.test(verb)) return "success";
  if (WARNING.test(verb)) return "warning";
  return "neutral";
}

function actorDisplay(row: AdminAuditLogRow): AuditActorDisplay {
  if (!row.actorUserId) return { name: "System", email: null, kind: "system" };
  const actor = row.actor;
  if (actor?.kind === "staff") {
    return { name: actor.name?.trim() || "Staff member", email: actor.email, kind: "staff" };
  }
  return {
    name: actor?.name?.trim() || "A client",
    email: actor?.email ?? null,
    kind: "client",
  };
}

export function toAuditLogRows(
  rows: readonly AdminAuditLogRow[],
  viewer: { canOpenPlatformRoutes: boolean },
): AuditLogRowModel[] {
  return rows.map((row) => {
    const detail = buildAuditEventDetail(row.payload, formatStaffDateTime);
    return {
      id: row.id,
      at: row.occurredAt.toISOString(),
      actor: actorDisplay(row),
      actorUserId: row.actorUserId,
      action: domainEventLabel(row.eventType),
      actionCode: row.eventType,
      tone: auditActionTone(row.eventType),
      entity: {
        type: row.aggregateType,
        typeLabel: auditEntityTypeLabel(row.aggregateType),
        id: row.aggregateId,
        shortId: row.aggregateId.slice(0, 8),
        href: auditEntityHref(row.aggregateType, row.aggregateId, viewer),
      },
      summary: summariseAuditEvent(detail),
      detail,
    };
  });
}
