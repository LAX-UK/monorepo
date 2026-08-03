import type {
  AdminWorkItemSourceRow,
  IAdminWorkItemsReader,
} from "@auction/persistence/interfaces";
import {
  AML_REVIEW_ACCESS,
  CONDITION_REPORTS_ACCESS,
  FINANCE_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_ACCESS,
  LOT_FULFILMENT_ACCESS,
  SALES_ACCESS,
  SUBMISSIONS_ACCESS,
  userHasAccessTo,
} from "@auction/types";
import type { CapabilityRequirement, UserRole, UserStaffRole } from "@auction/types";
import type {
  AdminWorkItemActionDto,
  AdminWorkItemDto,
  AdminWorkItemsQuery,
} from "@auction/validators";
import {
  type WorkItemSeverity,
  applyWorkItemSla,
  compareWorkItems,
  isUrgentWorkItem,
} from "./admin-work-item-sla.policy.js";

export type AdminWorkItemsListResult = {
  items: AdminWorkItemDto[];
  nextCursor: string | null;
  counts: {
    total: number;
    urgent: number;
    byDomain: Record<AdminWorkItemDto["domain"], number>;
  };
};

type SourceFetcher = {
  access: CapabilityRequirement;
  fetch: () => Promise<AdminWorkItemSourceRow[]>;
  supportsAssignment?: boolean;
  filterRow?: (row: AdminWorkItemSourceRow) => boolean;
};

function compositeId(row: AdminWorkItemSourceRow): string {
  return `${row.kind}:${row.sourceId}`;
}

function stampActions(
  row: AdminWorkItemSourceRow,
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
): AdminWorkItemActionDto[] {
  const actions: AdminWorkItemActionDto[] = [];
  const can = (req: CapabilityRequirement) => userHasAccessTo(role, staffRole, req);

  switch (row.kind) {
    case "submission_review":
      if (can(SUBMISSIONS_ACCESS)) {
        if (row.meta?.submissionStatus === "submitted") actions.push("start_review");
        actions.push("approve", "reject", "assign_to_me");
      }
      break;
    case "payment_manual_review":
      if (can(FINANCE_ACCESS)) actions.push("capture", "refund");
      break;
    case "aml_screening":
      break;
    case "sof_case":
      break;
    case "condition_report":
      if (can(CONDITION_REPORTS_ACCESS)) {
        if (row.meta?.conditionReportStatus === "pending") actions.push("mark_in_progress");
        actions.push("decline");
      }
      break;
    case "sale_registration":
      if (can(SALES_ACCESS)) actions.push("approve_registration", "reject_registration");
      break;
    case "telephone_booking":
      if (can(SALES_ACCESS)) {
        if (row.meta?.bookingStatus === "requested") actions.push("confirm_telephone");
        actions.push("assign_clerk");
      }
      break;
    case "lot_fulfilment":
      if (can(LOT_FULFILMENT_ACCESS)) {
        const status = row.meta?.fulfilmentStatus;
        if (status === "awaiting_release") actions.push("release_fulfilment");
        if (status === "released") actions.push("ready_for_collection");
        if (status === "in_transit") actions.push("delivered");
      }
      break;
    case "lot_withdrawal":
      break;
    case "legal_entity_kyb":
      break;
    case "lot_draft_past_start":
      break;
  }

  return actions;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: number;
    };
    return typeof parsed.offset === "number" && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

const EMPTY_DOMAIN_COUNTS: Record<AdminWorkItemDto["domain"], number> = {
  finance: 0,
  compliance: 0,
  catalogue: 0,
  saleroom: 0,
  fulfilment: 0,
  clients: 0,
};

export class AdminWorkItemsService {
  constructor(private readonly reader: IAdminWorkItemsReader) {}

  async listWorkItems(input: {
    actorUserId: string;
    actorRole: UserRole;
    actorStaffRole: UserStaffRole | null | undefined;
    query: AdminWorkItemsQuery;
  }): Promise<AdminWorkItemsListResult> {
    const { actorUserId, actorRole, actorStaffRole, query } = input;
    const perSourceLimit = Math.min(50, Math.max(query.limit * 2, 25));
    const offset = decodeCursor(query.cursor);

    const sources: SourceFetcher[] = [
      {
        access: FINANCE_ACCESS,
        fetch: () => this.reader.listManualReviewPayments(perSourceLimit),
      },
      {
        access: SUBMISSIONS_ACCESS,
        fetch: () =>
          this.reader.listSubmissionReviews({
            limit: perSourceLimit,
            assignment: query.assignment,
            actorUserId,
          }),
        supportsAssignment: true,
      },
      {
        access: CONDITION_REPORTS_ACCESS,
        fetch: () => this.reader.listConditionReports(perSourceLimit),
      },
      {
        access: LOT_FULFILMENT_ACCESS,
        fetch: () => this.reader.listLotFulfilment(perSourceLimit),
      },
      {
        access: SALES_ACCESS,
        fetch: () => this.reader.listPendingRegistrations(perSourceLimit),
      },
      {
        access: SALES_ACCESS,
        fetch: () => this.reader.listPendingTelephoneBookings(perSourceLimit),
      },
      {
        access: LOTS_ACCESS,
        fetch: () => this.reader.listDraftLotsPastStart(perSourceLimit),
      },
    ];

    const canReviewTasks =
      userHasAccessTo(actorRole, actorStaffRole, AML_REVIEW_ACCESS) ||
      userHasAccessTo(actorRole, actorStaffRole, LOTS_ACCESS) ||
      userHasAccessTo(actorRole, actorStaffRole, LEGAL_ENTITY_BROWSE_ACCESS);

    if (canReviewTasks) {
      sources.push({
        access: AML_REVIEW_ACCESS,
        fetch: () =>
          this.reader.listPendingReviewTasks({
            limit: perSourceLimit,
            assignment: query.assignment,
            actorUserId,
          }),
        supportsAssignment: true,
        filterRow: (row) => {
          if (row.kind === "aml_screening" || row.kind === "sof_case") {
            return userHasAccessTo(actorRole, actorStaffRole, AML_REVIEW_ACCESS);
          }
          if (row.kind === "legal_entity_kyb") {
            return userHasAccessTo(actorRole, actorStaffRole, LEGAL_ENTITY_BROWSE_ACCESS);
          }
          if (row.kind === "lot_withdrawal") {
            return userHasAccessTo(actorRole, actorStaffRole, LOTS_ACCESS);
          }
          return false;
        },
      });
    }

    const enabledSources = sources.filter(
      (s) =>
        userHasAccessTo(actorRole, actorStaffRole, s.access) &&
        (query.assignment !== "mine" || s.supportsAssignment === true),
    );

    const rawRows = (await Promise.all(enabledSources.map((s) => s.fetch()))).flatMap(
      (rows, index) => {
        const filterRow = enabledSources[index]?.filterRow;
        return filterRow ? rows.filter(filterRow) : rows;
      },
    );

    const enriched = rawRows.map((row) => {
      const sla = applyWorkItemSla(row);
      const id = compositeId(row);
      return {
        id,
        kind: row.kind,
        domain: row.domain,
        title: row.title,
        subtitle: row.subtitle,
        href: row.href,
        saleId: row.saleId,
        createdAt: row.createdAt.toISOString(),
        sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
        dueAt: sla.dueAt,
        severity: sla.severity as WorkItemSeverity,
        isOverdue: sla.isOverdue,
        urgencyLabel: sla.urgencyLabel,
        assignedToUserId: row.assignedToUserId,
        actions: stampActions(row, actorRole, actorStaffRole),
      };
    });

    let filtered = enriched;

    if (query.domain) {
      filtered = filtered.filter((item) => item.domain === query.domain);
    }

    if (query.assignment === "mine") {
      filtered = filtered.filter(
        (item) => item.assignedToUserId != null && item.assignedToUserId === actorUserId,
      );
    } else if (query.assignment === "unassigned") {
      filtered = filtered.filter((item) => item.assignedToUserId == null);
    }

    if (query.urgentOnly) {
      filtered = filtered.filter((item) => isUrgentWorkItem(item));
    }

    filtered.sort((a, b) =>
      compareWorkItems(
        {
          severity: a.severity,
          isOverdue: a.isOverdue,
          dueAt: a.dueAt,
          sourceUpdatedAt: a.sourceUpdatedAt,
          id: a.id,
        },
        {
          severity: b.severity,
          isOverdue: b.isOverdue,
          dueAt: b.dueAt,
          sourceUpdatedAt: b.sourceUpdatedAt,
          id: b.id,
        },
      ),
    );

    const byDomain = { ...EMPTY_DOMAIN_COUNTS };
    let urgent = 0;
    for (const item of filtered) {
      byDomain[item.domain] += 1;
      if (isUrgentWorkItem(item)) urgent += 1;
    }

    const page = filtered.slice(offset, offset + query.limit);
    const nextOffset = offset + query.limit;
    const nextCursor = nextOffset < filtered.length ? encodeCursor(nextOffset) : null;

    const items: AdminWorkItemDto[] = page.map(
      ({ isOverdue: _isOverdue, urgencyLabel: _urgencyLabel, ...item }) => item,
    );

    return {
      items,
      nextCursor,
      counts: {
        total: filtered.length,
        urgent,
        byDomain,
      },
    };
  }
}
