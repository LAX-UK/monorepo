import type {
  DataRequestRecord,
  DataRequestSummary,
  DataRequestView,
  DownloadRequestView,
  ManualRequestView,
} from "@auction/identity-contracts/data-requests";

/** Data requests as the Bid API returns them, for tests and the screenshot stub. */

export const TODAY = "2026-11-02";

const base = {
  hasAccount: true,
  extended: false,
  productsDone: { done: 0, total: 3 },
} as const;

export function download(overrides: Partial<DownloadRequestView> = {}): DownloadRequestView {
  return {
    ...base,
    kind: "download",
    reference: "DL-7F3C1A",
    personLabel: "s•••••@g•••••.com",
    products: ["account", "bid", "shop"],
    productsDone: { done: 2, total: 3 },
    requestedOn: "2026-10-29",
    dueOn: "2026-11-29",
    due: { state: "ok", daysLeft: 27 },
    status: "delayed",
    continuedAs: null,
    ...overrides,
  };
}

export function manual(overrides: Partial<ManualRequestView> = {}): ManualRequestView {
  return {
    ...base,
    kind: "manual",
    reference: "DR-0012",
    personLabel: "m•••••@o•••••.co.uk",
    products: ["bid", "shop"],
    productsDone: { done: 1, total: 2 },
    requestedOn: "2026-10-01",
    dueOn: "2026-11-01",
    due: { state: "overdue", daysLeft: -1 },
    status: "in_progress",
    reason: "full_copy",
    channel: "email",
    outcome: null,
    daysLate: null,
    ...overrides,
  };
}

export const overdueManual = manual();
export const dueSoonManual = manual({
  reference: "DR-0014",
  personLabel: "j•••••@h•••••.com",
  hasAccount: false,
  reason: "after_deletion",
  channel: "support_form",
  products: ["shop"],
  productsDone: { done: 0, total: 1 },
  requestedOn: "2026-10-09",
  dueOn: "2026-11-09",
  due: { state: "due_soon", daysLeft: 7 },
});
export const failedDownload = download({
  reference: "DL-A41C09",
  personLabel: "p•••••@g•••••.com",
  requestedOn: "2026-10-26",
  dueOn: "2026-11-26",
  due: { state: "ok", daysLeft: 24 },
  status: "failed",
  productsDone: { done: 2, total: 3 },
});
export const delayedDownload = download();
export const collectingDownload = download({
  reference: "DL-0B92E4",
  personLabel: "t•••••@l•••••.co.uk",
  requestedOn: "2026-11-02",
  dueOn: "2026-12-02",
  due: { state: "ok", daysLeft: 30 },
  status: "collecting",
  productsDone: { done: 1, total: 3 },
});
export const extendedManual = manual({
  reference: "DR-0011",
  personLabel: "a•••••@b•••••.com",
  channel: "post",
  products: ["account", "bid", "shop"],
  productsDone: { done: 2, total: 3 },
  requestedOn: "2026-09-18",
  dueOn: "2026-12-18",
  extended: true,
  due: { state: "ok", daysLeft: 46 },
});
export const waitingManual = manual({
  reference: "DR-0016",
  personLabel: "r•••••@y•••••.com",
  channel: "phone",
  products: ["bid"],
  productsDone: { done: 0, total: 1 },
  requestedOn: "2026-10-30",
  dueOn: null,
  due: { state: "none", daysLeft: null },
  status: "waiting_for_id",
});
export const closedOnTime = manual({
  reference: "DR-0010",
  personLabel: "k•••••@o•••••.com",
  products: ["account", "bid", "shop"],
  productsDone: { done: 3, total: 3 },
  requestedOn: "2026-09-02",
  dueOn: "2026-10-02",
  due: { state: "ok", daysLeft: -31 },
  status: "closed",
  outcome: "sent",
  daysLate: 0,
});
export const closedLate = manual({
  reference: "DR-0009",
  personLabel: "w•••••@p•••••.net",
  hasAccount: false,
  reason: "after_deletion",
  channel: "post",
  products: ["shop"],
  productsDone: { done: 1, total: 1 },
  requestedOn: "2026-08-20",
  dueOn: "2026-09-20",
  due: { state: "overdue", daysLeft: -43 },
  status: "closed",
  outcome: "nothing_held",
  daysLate: 3,
});
export const readyDownload = download({
  reference: "DL-55E0D7",
  personLabel: "h•••••@g•••••.com",
  requestedOn: "2026-10-30",
  dueOn: "2026-11-30",
  due: { state: "ok", daysLeft: 28 },
  status: "ready",
  productsDone: { done: 3, total: 3 },
});
export const continuedDownload = download({
  reference: "DL-19AA3F",
  personLabel: "c•••••@i•••••.com",
  requestedOn: "2026-10-12",
  dueOn: "2026-11-12",
  due: { state: "ok", daysLeft: 10 },
  status: "failed",
  continuedAs: "DR-0013",
});

export const OPEN_ROWS: DataRequestView[] = [
  overdueManual,
  dueSoonManual,
  failedDownload,
  delayedDownload,
  collectingDownload,
  extendedManual,
  waitingManual,
];

export const CLOSED_ROWS: DataRequestView[] = [
  closedOnTime,
  readyDownload,
  closedLate,
  continuedDownload,
];

export const SUMMARY: DataRequestSummary = {
  open: 7,
  dueSoon: 1,
  overdue: 1,
  waitingForId: 1,
  answeredLast12Months: { answered: 42, onTime: 41 },
};

// Records ---------------------------------------------------------------------------------------

const person: DataRequestRecord["person"] = {
  name: "Margaret Osei",
  email: "margaret.osei@outlook.co.uk",
  contact: null,
  hasAccount: true,
  joinedOn: "2019-03-14",
  accountStatus: "Active",
};

export const manualRecord: DataRequestRecord = {
  request: overdueManual,
  person,
  ownRequest: false,
  version: 4,
  notes:
    "Wants everything, including notes our team wrote about a 2024 consignment and the Zoho history. Download sent separately on 3 Oct (DL-3C77B0). Waiting on the Zoho export from the CRM owner.",
  steps: [
    {
      product: "bid",
      state: "done",
      gatheredAt: "2026-10-28T16:40:00.000Z",
      gatheredBy: "Hana Ito",
      records: null,
    },
    { product: "shop", state: "waiting", gatheredAt: null, gatheredBy: null, records: null },
  ],
  extension: null,
  outcomeNote: null,
  complaintRightTold: null,
  closedOn: null,
  continuedFrom: null,
  file: null,
  timeline: [
    {
      at: "2026-10-01T11:20:00.000Z",
      event: "data_request.logged",
      actorName: "Hana Ito",
      device: null,
      detail: { reason: "full_copy", channel: "email", receivedOn: "2026-10-01" },
    },
    {
      at: "2026-10-14T09:05:00.000Z",
      event: "data_request.notes_edited",
      actorName: "Hana Ito",
      device: null,
      detail: {},
    },
    {
      at: "2026-10-28T16:40:00.000Z",
      event: "data_request.product_gathered",
      actorName: "Hana Ito",
      device: null,
      detail: { product: "bid" },
    },
  ],
};

export const downloadRecord: DataRequestRecord = {
  request: delayedDownload,
  person: {
    name: "Sarah Whitlock",
    email: "sarah.whitlock@gmail.com",
    contact: null,
    hasAccount: true,
    joinedOn: "2021-05-04",
    accountStatus: "Active",
  },
  ownRequest: false,
  version: 0,
  notes: null,
  steps: [
    {
      product: "account",
      state: "done",
      gatheredAt: "2026-10-29T14:03:00.000Z",
      gatheredBy: null,
      records: 214,
    },
    {
      product: "bid",
      state: "done",
      gatheredAt: "2026-10-29T14:05:00.000Z",
      gatheredBy: null,
      records: 1032,
    },
    { product: "shop", state: "retrying", gatheredAt: null, gatheredBy: null, records: null },
  ],
  extension: null,
  outcomeNote: null,
  complaintRightTold: null,
  closedOn: null,
  continuedFrom: null,
  file: null,
  timeline: [
    {
      at: "2026-10-29T14:02:00.000Z",
      event: "data_export.requested",
      actorName: null,
      device: "Safari on iPhone",
      detail: {},
    },
    {
      at: "2026-10-29T14:03:00.000Z",
      event: "data_export.product_collected",
      actorName: null,
      device: null,
      detail: { product: "account", categories: 9, records: 214 },
    },
    {
      at: "2026-10-29T14:05:00.000Z",
      event: "data_export.product_collected",
      actorName: null,
      device: null,
      detail: { product: "bid", categories: 12, records: 1032 },
    },
    {
      at: "2026-10-30T14:02:00.000Z",
      event: "data_export.deadline_alert",
      actorName: null,
      device: null,
      detail: { tier: 1 },
    },
  ],
};

export const waitingRecord: DataRequestRecord = {
  ...manualRecord,
  request: waitingManual,
  steps: [{ product: "bid", state: "waiting", gatheredAt: null, gatheredBy: null, records: null }],
  notes: null,
};

export const closedRecord: DataRequestRecord = {
  ...manualRecord,
  request: closedLate,
  outcomeNote: "Looked in orders, consignments and the CRM.",
  closedOn: "2026-09-23",
  steps: [
    {
      product: "shop",
      state: "done",
      gatheredAt: "2026-09-22T10:00:00.000Z",
      gatheredBy: "Hana Ito",
      records: null,
    },
  ],
};

export const extendedRecord: DataRequestRecord = {
  ...manualRecord,
  request: extendedManual,
  steps: [
    {
      product: "account",
      state: "done",
      gatheredAt: "2026-10-02T10:00:00.000Z",
      gatheredBy: "Hana Ito",
      records: null,
    },
    {
      product: "bid",
      state: "done",
      gatheredAt: "2026-10-05T10:00:00.000Z",
      gatheredBy: "Hana Ito",
      records: null,
    },
    { product: "shop", state: "waiting", gatheredAt: null, gatheredBy: null, records: null },
  ],
  extension: {
    originalDueOn: "2026-10-18",
    extendedDueOn: "2026-12-18",
    reason: "complex",
    note: "Twelve years of correspondence across Bid and Shop.",
    personToldOn: "2026-10-10",
    personToldVia: "post",
  },
};

export const ownRecord: DataRequestRecord = { ...downloadRecord, ownRequest: true };
