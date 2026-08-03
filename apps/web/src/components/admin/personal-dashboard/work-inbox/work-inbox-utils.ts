import type { AttentionDomain } from "@/lib/admin/admin-home-types";
import type {
  AdminWorkItem,
  AdminWorkItemDomain,
  AdminWorkItemSeverity,
} from "@/lib/data/http/admin-work-items.schema";

export type AssignmentFilter = "mine" | "unassigned" | "all";

export const ASSIGNMENT_KINDS = new Set([
  "submission_review",
  "aml_screening",
  "sof_case",
  "legal_entity_kyb",
  "lot_withdrawal",
]);

export const DOMAIN_CHIP_MAP: Record<AttentionDomain, AdminWorkItemDomain[]> = {
  Finance: ["finance"],
  Compliance: ["compliance"],
  Catalog: ["catalogue"],
  Operations: ["saleroom", "fulfilment"],
  People: ["clients"],
};

export function itemSupportsAssignment(item: AdminWorkItem): boolean {
  return ASSIGNMENT_KINDS.has(item.kind);
}

export function filterWorkInboxItems(
  items: readonly AdminWorkItem[],
  domain: AdminWorkItemDomain | "all",
  assignment: AssignmentFilter,
  actorUserId: string,
): AdminWorkItem[] {
  return items.filter((item) => {
    if (domain !== "all" && item.domain !== domain) return false;
    if (assignment === "all") return true;
    if (!itemSupportsAssignment(item)) return false;
    if (assignment === "mine") return item.assignedToUserId === actorUserId;
    return item.assignedToUserId == null;
  });
}

export function domainOptions(
  queueDomains: readonly AttentionDomain[],
  _counts: Partial<Record<AdminWorkItemDomain, number>>,
): AdminWorkItemDomain[] {
  const domains = new Set<AdminWorkItemDomain>();
  for (const attentionDomain of queueDomains) {
    for (const domain of DOMAIN_CHIP_MAP[attentionDomain] ?? []) {
      domains.add(domain);
    }
  }
  return [...domains];
}

export function severityAccentClass(severity: AdminWorkItemSeverity): string {
  switch (severity) {
    case "critical":
      return "border-l-live-red";
    case "high":
      return "border-l-lot-orange";
    case "medium":
      return "border-l-outline-variant";
    default:
      return "border-l-transparent";
  }
}

export function ownerLabel(item: AdminWorkItem, actorUserId: string): string {
  if (!itemSupportsAssignment(item)) return "—";
  if (item.assignedToUserId === actorUserId) return "You";
  if (item.assignedToUserId) return "Assigned";
  return "Unassigned";
}

export function entityId(item: AdminWorkItem): string {
  const parts = item.id.split(":");
  return parts.length > 1 ? (parts[1] ?? item.id) : item.id;
}
