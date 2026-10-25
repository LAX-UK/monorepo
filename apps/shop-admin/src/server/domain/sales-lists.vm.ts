import {
  ADMIN_DISPUTE_STATUSES,
  ADMIN_FULFILMENT_OPEN_STATUSES,
  ADMIN_FULFILMENT_OPTIONS,
  ADMIN_FULFILMENT_STATUSES,
  ADMIN_ORIGINAL_SALE_STATUSES,
  ADMIN_PAYOUT_SOURCES,
  ADMIN_SALE_AUTHORITY_REQUEST_STATUSES,
  ADMIN_STOCK_HOLD_STATUSES,
  ADMIN_THIRD_PARTY_SALE_STATUSES,
  ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
  PRODUCTION_TASK_SEARCH_MAX_LENGTH,
  PRODUCTION_TASK_STATUSES,
} from "@auction/shop-contracts";
import { type LaxStatusDomain, staffStatusLabel } from "./staff-status";
import { type WorkListView, defineWorkList, statusViews } from "./work-list.vm";

/*
 * The sales and operations lists in LAX Admin: each one's views, filters, sorts and the param
 * that opens a record in its panel. The first sort key of each is the API's default.
 */

const ALL: WorkListView = { id: "all", label: "All", api: {} };

function byStatus(domain: LaxStatusDomain, statuses: readonly string[]): WorkListView[] {
  return statusViews(statuses, (status) => staffStatusLabel(domain, status));
}

const created = { created: { asc: "created_asc", desc: "created_desc" } };

export const originalSalesList = defineWorkList({
  path: "/original-sales",
  views: [ALL, ...byStatus("originalSale", ADMIN_ORIGINAL_SALE_STATUSES)],
  defaultView: "all",
  filters: {},
  sorts: created,
  defaultSort: "created_desc",
  panelParam: "sale",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const thirdPartySalesList = defineWorkList({
  path: "/third-party-sales",
  views: [ALL, ...byStatus("thirdPartySale", ADMIN_THIRD_PARTY_SALE_STATUSES)],
  defaultView: "all",
  filters: { fee: ["pending"] },
  sorts: created,
  defaultSort: "created_desc",
  panelParam: "sale",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const holdsList = defineWorkList({
  path: "/holds",
  views: [ALL, ...byStatus("hold", ADMIN_STOCK_HOLD_STATUSES)],
  defaultView: "all",
  filters: {},
  sorts: { ...created, expires: { asc: "expires_asc", desc: "expires_desc" } },
  defaultSort: "created_desc",
  panelParam: "hold",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const disputesList = defineWorkList({
  path: "/disputes",
  views: [ALL, ...byStatus("dispute", ADMIN_DISPUTE_STATUSES)],
  defaultView: "all",
  filters: {},
  sorts: { opened: { asc: "opened_asc", desc: "opened_desc" } },
  defaultSort: "opened_desc",
  panelParam: "dispute",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const payoutsList = defineWorkList({
  path: "/payouts",
  views: [ALL, ...byStatus("payout", ["due", "pending_refund_period", "paid", "cancelled"])],
  defaultView: "all",
  filters: { source: ADMIN_PAYOUT_SOURCES },
  sorts: { due: { asc: "due_asc", desc: "due_desc" }, ...created },
  defaultSort: "due_asc",
  panelParam: "payout",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

const FULFILMENT_DONE = ADMIN_FULFILMENT_STATUSES.filter(
  (status) => !(ADMIN_FULFILMENT_OPEN_STATUSES as readonly string[]).includes(status),
);

export const fulfilmentList = defineWorkList({
  path: "/fulfilment",
  views: [
    {
      id: "open",
      label: "To do",
      api: { stage: "open" },
      statuses: ADMIN_FULFILMENT_OPEN_STATUSES,
    },
    ...byStatus("fulfilment", ["awaiting_dispatch", "in_transit", "ready_for_collection"]),
    { id: "done", label: "Done", api: { stage: "done" }, statuses: FULFILMENT_DONE },
    ALL,
  ],
  defaultView: "open",
  filters: { option: ADMIN_FULFILMENT_OPTIONS },
  sorts: { updated: { asc: "updated_asc", desc: "updated_desc" } },
  defaultSort: "updated_desc",
  panelParam: "fulfilment",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const saleRequestsList = defineWorkList({
  path: "/requests",
  views: [...byStatus("saleRequest", ADMIN_SALE_AUTHORITY_REQUEST_STATUSES), ALL],
  defaultView: "pending",
  filters: {},
  sorts: created,
  defaultSort: "created_desc",
  panelParam: "request",
  searchMaxLength: ADMIN_WORK_LIST_SEARCH_MAX_LENGTH,
});

export const productionList = defineWorkList({
  path: "/production",
  views: [ALL, ...byStatus("production", PRODUCTION_TASK_STATUSES)],
  defaultView: "all",
  filters: { assignee: ["me", "unassigned"] },
  sorts: created,
  defaultSort: "created_desc",
  panelParam: "task",
  searchMaxLength: PRODUCTION_TASK_SEARCH_MAX_LENGTH,
});
