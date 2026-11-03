import type {
  AdminWorkItemSourceKind,
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
  MARKETING_ENQUIRIES_ACCESS,
  PAYMENT_WRITE_ACCESS,
  SALES_ACCESS,
  SUBMISSIONS_ACCESS,
  canOpenAdminLink,
  requirementCapabilities,
  userHasAccessTo,
} from "@auction/types";
import type { CapabilityRequirement, StaffRoles, UserRole } from "@auction/types";
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

/**
 * What a person needs to see each kind of work item. The item's link opens a page whose own
 * guard is no stricter than this, which the staff alert links contract test checks.
 */
export const WORK_ITEM_KIND_ACCESS: Record<AdminWorkItemSourceKind, CapabilityRequirement> = {
  payment_manual_review: FINANCE_ACCESS,
  payment_capture_blocked: FINANCE_ACCESS,
  aml_screening: AML_REVIEW_ACCESS,
  sof_case: AML_REVIEW_ACCESS,
  submission_review: SUBMISSIONS_ACCESS,
  condition_report: CONDITION_REPORTS_ACCESS,
  lot_fulfilment: LOT_FULFILMENT_ACCESS,
  sale_registration: SALES_ACCESS,
  telephone_booking: SALES_ACCESS,
  legal_entity_kyb: LEGAL_ENTITY_BROWSE_ACCESS,
  lot_withdrawal: LOTS_ACCESS,
  lot_draft_past_start: LOTS_ACCESS,
  unsold_lot_choice: SUBMISSIONS_ACCESS,
  marketing_enquiry: MARKETING_ENQUIRIES_ACCESS,
  purchase_problem: FINANCE_ACCESS,
  // The default action lives on the lot page, which finance-only staff cannot open.
  payment_overdue: SALES_ACCESS,
};

const REVIEW_TASK_SOURCE_ACCESS: CapabilityRequirement = {
  anyOf: [
    ...new Set(
      [
        WORK_ITEM_KIND_ACCESS.aml_screening,
        WORK_ITEM_KIND_ACCESS.sof_case,
        WORK_ITEM_KIND_ACCESS.legal_entity_kyb,
        WORK_ITEM_KIND_ACCESS.lot_withdrawal,
      ].flatMap(requirementCapabilities),
    ),
  ],
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
  staffRoles: StaffRoles | undefined,
): AdminWorkItemActionDto[] {
  const actions: AdminWorkItemActionDto[] = [];
  const can = (req: CapabilityRequirement) => userHasAccessTo(role, staffRoles, req);

  switch (row.kind) {
    case "submission_review":
      if (can(SUBMISSIONS_ACCESS)) {
        if (row.meta?.submissionStatus === "submitted") actions.push("start_review");
        actions.push("approve", "reject", "assign_to_me");
      }
      break;
    case "payment_manual_review":
      if (can(PAYMENT_WRITE_ACCESS)) actions.push("capture", "refund");
      break;
    case "payment_capture_blocked":
      if (can(PAYMENT_WRITE_ACCESS)) actions.push("reinstate_payment", "refund");
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
    case "unsold_lot_choice":
      break;
    case "marketing_enquiry":
    case "purchase_problem":
    case "payment_overdue":
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
    actorStaffRoles: StaffRoles | undefined;
    query: AdminWorkItemsQuery;
  }): Promise<AdminWorkItemsListResult> {
    const { actorUserId, actorRole, actorStaffRoles, query } = input;
    const perSourceLimit = Math.min(50, Math.max(query.limit * 2, 25));
    const offset = decodeCursor(query.cursor);

    const sources: SourceFetcher[] = [
      {
        access: WORK_ITEM_KIND_ACCESS.payment_manual_review,
        fetch: () => this.reader.listManualReviewPayments(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.payment_capture_blocked,
        fetch: () => this.reader.listBlockedCaptures(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.submission_review,
        fetch: () =>
          this.reader.listSubmissionReviews({
            limit: perSourceLimit,
            assignment: query.assignment,
            actorUserId,
          }),
        supportsAssignment: true,
      },
      {
        access: WORK_ITEM_KIND_ACCESS.condition_report,
        fetch: () => this.reader.listConditionReports(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.lot_fulfilment,
        fetch: () => this.reader.listLotFulfilment(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.sale_registration,
        fetch: () => this.reader.listPendingRegistrations(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.telephone_booking,
        fetch: () => this.reader.listPendingTelephoneBookings(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.lot_draft_past_start,
        fetch: () => this.reader.listDraftLotsPastStart(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.unsold_lot_choice,
        fetch: () => this.reader.listUnsoldLotChoices(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.marketing_enquiry,
        fetch: () => this.reader.listMarketingEnquiries(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.purchase_problem,
        fetch: () => this.reader.listPurchaseProblems(perSourceLimit),
      },
      {
        access: WORK_ITEM_KIND_ACCESS.payment_overdue,
        fetch: () => this.reader.listOverduePayments(perSourceLimit, new Date()),
      },
    ];

    // Review tasks of several kinds share one source; each row is kept only if the person can
    // see its own kind, so the source opens for anyone who can see at least one of them.
    sources.push({
      access: REVIEW_TASK_SOURCE_ACCESS,
      fetch: () =>
        this.reader.listPendingReviewTasks({
          limit: perSourceLimit,
          assignment: query.assignment,
          actorUserId,
        }),
      supportsAssignment: true,
      filterRow: (row) =>
        userHasAccessTo(actorRole, actorStaffRoles, WORK_ITEM_KIND_ACCESS[row.kind]),
    });

    const enabledSources = sources.filter(
      (s) =>
        userHasAccessTo(actorRole, actorStaffRoles, s.access) &&
        (query.assignment !== "mine" || s.supportsAssignment === true),
    );

    // An item is shown only if its link opens for this person, so an alert never leads to a
    // page that turns them away (a finance-only member holds `legal_entity.read` but cannot
    // enter the platform pages that show an entity).
    const rawRows = (await Promise.all(enabledSources.map((s) => s.fetch()))).flatMap(
      (rows, index) => {
        const filterRow = enabledSources[index]?.filterRow;
        const visible = filterRow ? rows.filter(filterRow) : rows;
        return visible.filter((row) => canOpenAdminLink(actorRole, actorStaffRoles, row.href));
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
        actions: stampActions(row, actorRole, actorStaffRoles),
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
