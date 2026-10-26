import type { AttentionDomain } from "@/lib/admin/admin-home-types";
import type {
  AdminWorkItem,
  AdminWorkItemAction,
  AdminWorkItemDomain,
  AdminWorkItemSeverity,
} from "@/lib/data/http/admin-work-items.schema";
import type { StatusPresentation } from "@auction/staff-ui";

export type WorkAssignment = "mine" | "unassigned" | "all";
export type WorkArea = AdminWorkItemDomain | "all";

export const WORK_AREA_LABELS: Record<AdminWorkItemDomain, string> = {
  finance: "Finance",
  compliance: "Compliance",
  catalogue: "Catalogue",
  saleroom: "Saleroom",
  fulfilment: "Fulfilment",
  clients: "Clients",
};

const WORK_AREAS = Object.keys(WORK_AREA_LABELS) as AdminWorkItemDomain[];

/** The work areas each dashboard profile's queue groups cover. */
const AREAS_BY_QUEUE: Record<AttentionDomain, AdminWorkItemDomain[]> = {
  Finance: ["finance"],
  Compliance: ["compliance"],
  Catalog: ["catalogue"],
  Operations: ["saleroom", "fulfilment"],
  People: ["clients"],
};

/** Each action as a menu item and a button: the verb, and the object where it helps. */
export const WORK_ACTION_LABELS: Record<AdminWorkItemAction, string> = {
  start_review: "Start review",
  approve: "Approve",
  reject: "Reject",
  assign_to_me: "Assign to me",
  mark_in_progress: "Claim",
  decline: "Decline",
  capture: "Capture payment",
  refund: "Refund payment",
  approve_registration: "Approve registration",
  reject_registration: "Reject registration",
  confirm_telephone: "Confirm booking",
  assign_clerk: "Assign me as clerk",
  release_fulfilment: "Release for fulfilment",
  ready_for_collection: "Mark ready for collection",
  delivered: "Mark delivered",
};

/** Past tense for the toast once an action is done: "Payment captured". */
const WORK_ACTION_DONE: Record<AdminWorkItemAction, string> = {
  start_review: "Review started",
  approve: "Approved",
  reject: "Rejected",
  assign_to_me: "Assigned to you",
  mark_in_progress: "Claimed",
  decline: "Declined",
  capture: "Payment captured",
  refund: "Refund started",
  approve_registration: "Registration approved",
  reject_registration: "Registration rejected",
  confirm_telephone: "Booking confirmed",
  assign_clerk: "Assigned you as clerk",
  release_fulfilment: "Released for fulfilment",
  ready_for_collection: "Marked ready for collection",
  delivered: "Marked delivered",
};

/** Actions that ask first: they move money, tell a customer, or cannot be taken back. */
const CONFIRMED_ACTIONS = new Set<AdminWorkItemAction>([
  "reject",
  "capture",
  "refund",
  "reject_registration",
  "release_fulfilment",
  "delivered",
]);

const DESTRUCTIVE_ACTIONS = new Set<AdminWorkItemAction>([
  "reject",
  "refund",
  "reject_registration",
]);

/** Kinds whose work can be assigned to a person. */
const ASSIGNABLE_KINDS = new Set<string>([
  "submission_review",
  "aml_screening",
  "sof_case",
  "legal_entity_kyb",
  "lot_withdrawal",
]);

export function workActionDone(item: AdminWorkItem, action: AdminWorkItemAction): string {
  return `${WORK_ACTION_DONE[action]}: ${item.title}`;
}

export function workActionIsDestructive(action: AdminWorkItemAction): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

/** What the confirm says before an action that moves money or cannot be taken back. */
export function workActionConfirm(
  item: AdminWorkItem,
  action: AdminWorkItemAction,
): { title: string; description: string; confirmLabel: string } | null {
  if (!CONFIRMED_ACTIONS.has(action) || action === "refund") return null;
  const label = WORK_ACTION_LABELS[action];
  const asks: Partial<Record<AdminWorkItemAction, { title: string; description: string }>> = {
    reject: {
      title: `Reject ${item.title}?`,
      description: "The submitter is told it was not accepted. This cannot be undone from here.",
    },
    capture: {
      title: `Capture the payment for ${item.title}?`,
      description: "The buyer's card is charged the authorised amount.",
    },
    reject_registration: {
      title: `Reject the registration for ${item.title}?`,
      description: "The bidder is told they cannot bid in this sale.",
    },
    release_fulfilment: {
      title: `Release ${item.title} for fulfilment?`,
      description: "The lot moves on to packing and dispatch.",
    },
    delivered: {
      title: `Mark ${item.title} delivered?`,
      description: "The buyer is told their lot has arrived.",
    },
  };
  const ask = asks[action];
  return ask ? { ...ask, confirmLabel: label } : null;
}

/** Urgent and high work is marked; everything else carries no badge, so the marks stand out. */
export function workPriority(severity: AdminWorkItemSeverity): StatusPresentation | null {
  if (severity === "critical") return { label: "Urgent", tone: "danger" };
  if (severity === "high") return { label: "High", tone: "warning" };
  return null;
}

export function workItemIsAssignable(item: AdminWorkItem): boolean {
  return ASSIGNABLE_KINDS.has(item.kind);
}

/** Who has the work: "You", "Someone else" or "No one yet"; null when it is never assigned. */
export function workOwner(item: AdminWorkItem, actorUserId: string): string | null {
  if (!workItemIsAssignable(item)) return null;
  if (item.assignedToUserId === actorUserId) return "You";
  if (item.assignedToUserId) return "Someone else";
  return "No one yet";
}

/** The work areas this person's dashboard shows, in a fixed order. */
export function workAreasFor(queues: readonly AttentionDomain[]): AdminWorkItemDomain[] {
  const allowed = new Set(queues.flatMap((queue) => AREAS_BY_QUEUE[queue] ?? []));
  return WORK_AREAS.filter((area) => allowed.has(area));
}

export function parseWorkArea(raw: string | undefined): WorkArea {
  return raw && (WORK_AREAS as string[]).includes(raw) ? (raw as AdminWorkItemDomain) : "all";
}

export function parseWorkAssignment(raw: string | undefined): WorkAssignment {
  return raw === "mine" || raw === "unassigned" ? raw : "all";
}

export function filterWorkByArea(items: readonly AdminWorkItem[], area: WorkArea): AdminWorkItem[] {
  return area === "all" ? [...items] : items.filter((item) => item.domain === area);
}

/** The Overview URL for an area and assignment, keeping the metrics period. */
export function workInboxHref(
  base: { area: WorkArea; assignment: WorkAssignment; period?: string | undefined },
  change: Partial<{ area: WorkArea; assignment: WorkAssignment; item: string | null }> = {},
): string {
  const area = change.area ?? base.area;
  const assignment = change.assignment ?? base.assignment;
  const params = new URLSearchParams();
  if (area !== "all") params.set("area", area);
  if (assignment !== "all") params.set("assignment", assignment);
  if (base.period) params.set("period", base.period);
  if (change.item) params.set("item", change.item);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

/** One tab per area this person works in, each with its count, after "All". */
export function workAreaViews(input: {
  areas: readonly AdminWorkItemDomain[];
  counts: Partial<Record<AdminWorkItemDomain, number>>;
  total: number;
  href: (area: WorkArea) => string;
}) {
  return [
    { id: "all", label: "All", count: input.total, href: input.href("all") },
    ...input.areas.map((area) => ({
      id: area,
      label: WORK_AREA_LABELS[area],
      count: input.counts[area] ?? 0,
      href: input.href(area),
    })),
  ];
}

/**
 * The one action every chosen item offers, for the bulk bar. Refunds are never bulk: each needs
 * its own reason and confirm.
 */
export function sharedWorkAction(items: readonly AdminWorkItem[]): AdminWorkItemAction | null {
  const [first, ...rest] = items;
  if (!first) return null;
  return (
    first.actions.find(
      (action) => action !== "refund" && rest.every((item) => item.actions.includes(action)),
    ) ?? null
  );
}

/** The record behind a work item: "payment:pay_1" is payment pay_1. */
export function workItemEntityId(item: AdminWorkItem): string {
  const [, id] = item.id.split(":");
  return id ?? item.id;
}

/** "3 items · 1 urgent". */
export function workInboxSummary(items: readonly AdminWorkItem[]): string {
  const urgent = items.filter((item) => item.severity === "critical").length;
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  return urgent > 0 ? `${count} · ${urgent} urgent` : count;
}
