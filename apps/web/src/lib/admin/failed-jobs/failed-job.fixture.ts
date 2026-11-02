import type { FailedJobDetail, FailedJobList, FailedJobSummary } from "@auction/types";

/** Failed jobs as the API returns them, for component tests. */
export const emailJob: FailedJobSummary = {
  id: "dlq:email:55120",
  queue: "email",
  typeLabel: "Email",
  jobLabel: "Outbid notice",
  sourceLabel: "Background job · Email",
  errorSummary: "Mail provider rejected the message: inactive recipient l•••••@n•••••.com",
  attempts: 5,
  firstFailedAt: "2026-11-01T07:12:00.000Z",
  lastFailedAt: "2026-11-01T07:44:00.000Z",
  state: "needs_review",
  mayRepeat: true,
  retry: { allowed: true },
};

export const lotScheduleJob: FailedJobSummary = {
  id: "dlq:lot-lifecycle:14",
  queue: "lot-lifecycle",
  typeLabel: "Lot schedule",
  jobLabel: "End lot",
  sourceLabel: "Background job · Lot schedule",
  errorSummary: "Lock not acquired within 30 s (lot 14, Modern British & Irish Art)",
  attempts: 3,
  firstFailedAt: "2026-10-31T19:00:00.000Z",
  lastFailedAt: "2026-10-31T19:01:00.000Z",
  state: "needs_review",
  mayRepeat: true,
  retry: {
    allowed: false,
    reason:
      "Lot start and end jobs aren't retried from here, because a repeat could open or close a lot twice. Hand this to engineering.",
  },
};

export const adEventJob: FailedJobSummary = {
  id: "dlq:marketing-events:9021",
  queue: "marketing-events",
  typeLabel: "Ad platform event",
  jobLabel: "Purchase",
  sourceLabel: "Background job · Ad platform events",
  errorSummary: "Access token expired",
  attempts: 5,
  firstFailedAt: "2026-10-30T09:00:00.000Z",
  lastFailedAt: "2026-10-31T23:58:00.000Z",
  state: "needs_review",
  mayRepeat: false,
  retry: { allowed: true },
};

export const statementJob: FailedJobSummary = {
  id: "dlq:payout-statements:77",
  queue: "payout-statements",
  typeLabel: "Payout statement",
  jobLabel: null,
  sourceLabel: "Background job · Payouts",
  errorSummary: "Query cancelled after 60 s",
  attempts: 3,
  firstFailedAt: "2026-10-30T11:15:00.000Z",
  lastFailedAt: "2026-10-30T11:17:00.000Z",
  state: "needs_review",
  mayRepeat: false,
  retry: { allowed: true },
};

export const failedJobList: FailedJobList = {
  rows: [emailJob, lotScheduleJob, adEventJob, statementJob],
  total: 4,
  counts: { needs_review: 4, retried: 2, discarded: 1 },
  queues: [
    { id: "email", label: "Email", count: 1 },
    { id: "lot-lifecycle", label: "Lot schedule", count: 1 },
    { id: "marketing-events", label: "Ad platform event", count: 1 },
    { id: "payout-statements", label: "Payout statement", count: 1 },
  ],
  actionsEnabled: true,
};

export const emailJobDetail: FailedJobDetail = {
  ...emailJob,
  retryEffect:
    "Sends this email again from the start. If an earlier attempt reached the mail provider, the client could receive it twice.",
  errorMessage:
    "PostmarkError 422: You tried to send to recipient(s) that have been marked as inactive. Found inactive addresses: l•••••@n•••••.com.",
  originalJobId: "55120",
  payload: [
    { label: "Template", value: "outbid-notice", masked: false },
    { label: "Email", value: "l•••••@n•••••.com", masked: true },
    { label: "Recipient name", value: "L. F•••", masked: true },
    { label: "Lot ID", value: "lot-14", masked: false },
    { label: "Amount", value: "£9,000.00", masked: false },
  ],
  omittedPayloadFields: 2,
  discard: null,
  history: [],
};
