import type {
  AdminWorkItemActionDto,
  AdminWorkItemDomainDto,
  AdminWorkItemDto,
  AdminWorkItemKindDto,
  AdminWorkItemSeverityDto,
  AdminWorkItemsResponseDto,
} from "@auction/validators";
import { adminWorkItemActionSchema } from "@auction/validators";

export type AdminWorkItem = AdminWorkItemDto;
export type AdminWorkItemKind = AdminWorkItemKindDto;
export type AdminWorkItemDomain = AdminWorkItemDomainDto;
export type AdminWorkItemAction = AdminWorkItemActionDto;
export type AdminWorkItemSeverity = AdminWorkItemSeverityDto;
export type AdminWorkItemsResponse = AdminWorkItemsResponseDto;

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseActions(raw: unknown): AdminWorkItemAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    const parsed = adminWorkItemActionSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseAdminWorkItem(raw: unknown): AdminWorkItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = parseString(o.id);
  const kind = parseString(o.kind) as AdminWorkItemKind | null;
  const domain = parseString(o.domain) as AdminWorkItemDomain | null;
  const title = parseString(o.title);
  const href = parseString(o.href);
  const createdAt = parseString(o.createdAt);
  const sourceUpdatedAt = parseString(o.sourceUpdatedAt);
  const severity = parseString(o.severity) as AdminWorkItemSeverity | null;
  if (!id || !kind || !domain || !title || !href || !createdAt || !sourceUpdatedAt || !severity) {
    return null;
  }
  return {
    id,
    kind,
    domain,
    title,
    href,
    createdAt,
    sourceUpdatedAt,
    severity,
    subtitle: parseString(o.subtitle),
    saleId: parseString(o.saleId),
    dueAt: parseString(o.dueAt),
    assignedToUserId: parseString(o.assignedToUserId),
    actions: parseActions(o.actions),
  };
}

export function parseAdminWorkItemsResponse(raw: unknown): AdminWorkItemsResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  const items = o.items
    .map(parseAdminWorkItem)
    .filter((item): item is AdminWorkItem => item != null);
  const countsRaw = o.counts;
  if (!countsRaw || typeof countsRaw !== "object") return null;
  const countsObj = countsRaw as Record<string, unknown>;
  const byDomainRaw = countsObj.byDomain;
  if (!byDomainRaw || typeof byDomainRaw !== "object") return null;
  const byDomain = byDomainRaw as Record<string, unknown>;

  return {
    items,
    nextCursor: parseString(o.nextCursor),
    counts: {
      total: typeof countsObj.total === "number" ? countsObj.total : items.length,
      urgent: typeof countsObj.urgent === "number" ? countsObj.urgent : 0,
      byDomain: {
        finance: typeof byDomain.finance === "number" ? byDomain.finance : 0,
        compliance: typeof byDomain.compliance === "number" ? byDomain.compliance : 0,
        catalogue: typeof byDomain.catalogue === "number" ? byDomain.catalogue : 0,
        saleroom: typeof byDomain.saleroom === "number" ? byDomain.saleroom : 0,
        fulfilment: typeof byDomain.fulfilment === "number" ? byDomain.fulfilment : 0,
        clients: typeof byDomain.clients === "number" ? byDomain.clients : 0,
      },
    },
  };
}
