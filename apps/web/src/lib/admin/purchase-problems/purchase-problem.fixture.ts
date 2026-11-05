import type {
  PurchaseProblemAssignee,
  PurchaseProblemListItem,
  PurchaseProblemListPage,
  PurchaseProblemView,
} from "@/lib/data/http/admin-purchase-problems.schema";

export const ASSIGNEES: PurchaseProblemAssignee[] = [
  { id: "u-sofia", name: "Sofia Okafor" },
  { id: "u-tom", name: "Tom Reid" },
];

const lot = {
  id: "lot-12",
  title: "Low tide at Maldon",
  lotNumber: 12,
  saleId: "sale-1",
  saleTitle: "Autumn Modern and Contemporary",
};

export const openProblem: PurchaseProblemView = {
  id: "3f2a9c1e-7b4d-4e0a-9d1f-5c6b7a8e9f00",
  reference: "PR-3F2A9C1E",
  status: "open",
  category: "damaged",
  buyerName: "Ada Lovelace",
  lot,
  raisedAt: "2026-11-02T09:14:00.000Z",
  assignedToUserId: null,
  message: "The frame arrived cracked along the left edge and the glass is chipped.",
  version: 1,
  payment: { id: "pay-1", status: "captured", amountMinor: 480_050 },
  resolvedAt: null,
  resolvedByUserId: null,
  nextStatuses: ["in_progress", "resolved"],
  notes: [],
};

export const inProgressProblem: PurchaseProblemView = {
  ...openProblem,
  status: "in_progress",
  assignedToUserId: "u-sofia",
  version: 3,
  nextStatuses: ["resolved"],
  notes: [
    {
      id: "n1",
      authorUserId: "u-sofia",
      body: "Asked the buyer for photos of the damage.",
      createdAt: "2026-11-03T10:30:00.000Z",
    },
  ],
};

export const resolvedProblem: PurchaseProblemView = {
  ...inProgressProblem,
  status: "resolved",
  version: 5,
  nextStatuses: [],
  resolvedAt: "2026-11-04T08:00:00.000Z",
  resolvedByUserId: "u-sofia",
  notes: [
    ...inProgressProblem.notes,
    {
      id: "n2",
      authorUserId: "u-sofia",
      body: "Refunded in full and arranged a courier collection.",
      createdAt: "2026-11-04T08:00:00.000Z",
    },
  ],
};

function item(over: Partial<PurchaseProblemListItem>): PurchaseProblemListItem {
  return {
    id: openProblem.id,
    reference: openProblem.reference,
    status: "open",
    category: "damaged",
    buyerName: "Ada Lovelace",
    lot,
    raisedAt: openProblem.raisedAt,
    assignedToUserId: null,
    ...over,
  };
}

export const listPage: PurchaseProblemListPage = {
  items: [
    item({}),
    item({
      id: "8b1d4e2f-0000-4000-8000-000000000002",
      reference: "PR-8B1D4E2F",
      category: "not_received",
      buyerName: "Marcus Webb",
      lot: { ...lot, id: "lot-31", title: "Harbour at dusk", lotNumber: 31 },
      raisedAt: "2026-11-03T14:05:00.000Z",
      assignedToUserId: "u-tom",
    }),
    item({
      id: "c4e7a901-0000-4000-8000-000000000003",
      reference: "PR-C4E7A901",
      category: "invoice_or_payment",
      buyerName: "Studio Nine Ltd",
      lot: {
        ...lot,
        id: "lot-7",
        title: "Untitled (blue)",
        lotNumber: null,
        saleId: null,
        saleTitle: null,
      },
      raisedAt: "2026-11-04T07:45:00.000Z",
    }),
  ],
  total: 3,
  page: 1,
  pageSize: 25,
  counts: { open: 3, in_progress: 1, resolved: 12 },
  sales: [{ id: "sale-1", title: "Autumn Modern and Contemporary" }],
};
