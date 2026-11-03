import type { FailedJobDetail, FailedJobList, FailedJobSummary } from "@auction/types";

/** Failed jobs as the API returns them, for component tests. */
export const emailJob: FailedJobSummary = {
  id: "job:dlq:email:55120",
  source: "background_jobs",
  canAct: true,
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
  id: "job:dlq:lot-lifecycle:14",
  source: "background_jobs",
  canAct: true,
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
  id: "job:dlq:marketing-events:9021",
  source: "background_jobs",
  canAct: true,
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
  id: "job:dlq:payout-statements:77",
  source: "background_jobs",
  canAct: true,
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

export const xeroDelivery: FailedJobSummary = {
  id: "delivery:41",
  source: "integrations.xero",
  canAct: true,
  queue: "delivery:xero",
  typeLabel: "Payment to Xero",
  jobLabel: "payment.captured",
  sourceLabel: "Integrations · Xero",
  errorSummary: "Xero rejected the invoice: contact l•••••@n•••••.com is archived (HTTP 400)",
  attempts: 6,
  firstFailedAt: "2026-11-01T07:12:00.000Z",
  lastFailedAt: "2026-11-01T07:44:00.000Z",
  state: "needs_review",
  mayRepeat: false,
  retry: { allowed: true },
};

export const zohoDelivery: FailedJobSummary = {
  ...xeroDelivery,
  id: "delivery:42",
  source: "integrations.zoho",
  queue: "delivery:zoho",
  typeLabel: "User registered to Zoho CRM",
  jobLabel: "user.registered",
  sourceLabel: "Integrations · Zoho CRM",
  errorSummary: "Zoho API rate limit reached (HTTP 429)",
};

export const stripeWebhook: FailedJobSummary = {
  ...xeroDelivery,
  id: "webhook:0b4f7c1e-2f61-4c3e-9d59-3f0f6f0a1111",
  source: "integrations.other",
  queue: "webhook:stripe",
  typeLabel: "Stripe webhook",
  jobLabel: "checkout.session.completed",
  sourceLabel: "Integrations · Stripe",
  errorSummary: "Handler timed out after 30 s",
  mayRepeat: true,
};

export const failedJobList: FailedJobList = {
  rows: [emailJob, lotScheduleJob, adEventJob, statementJob],
  total: 4,
  canAct: true,
  limitedTo: null,
  sources: [
    { id: "background_jobs", label: "Background jobs", count: 4 },
    { id: "integrations", label: "Integrations", count: 3 },
  ],
  counts: { needs_review: 4, retried: 2, discarded: 1 },
  queues: [
    { id: "email", label: "Email", count: 1 },
    { id: "lot-lifecycle", label: "Lot schedule", count: 1 },
    { id: "marketing-events", label: "Ad platform event", count: 1 },
    { id: "payout-statements", label: "Payout statement", count: 1 },
  ],
  actionsEnabled: true,
};

export const integrationsList: FailedJobList = {
  ...failedJobList,
  rows: [xeroDelivery, zohoDelivery, stripeWebhook],
  total: 3,
  sources: failedJobList.sources,
  queues: [
    { id: "delivery:xero", label: "Xero", count: 1 },
    { id: "delivery:zoho", label: "Zoho CRM", count: 1 },
    { id: "webhook:stripe", label: "Stripe webhooks", count: 1 },
  ],
};

export const xeroDeliveryDetail: FailedJobDetail = {
  ...xeroDelivery,
  retryEffect:
    "Sends this to Xero again with the same reference, so a retry can't create a second invoice or payment.",
  errorMessage:
    "Xero rejected the invoice: contact l•••••@n•••••.com is archived (HTTP 400). Restore the contact in Xero, then retry.",
  originalJobId: "41",
  payload: [
    { label: "Payment ID", value: "5f1c2d3e-aaaa-4bbb-8ccc-1234567890ab", masked: false },
    { label: "Lot ID", value: "lot-14", masked: false },
    { label: "Amount", value: "£9,000.00", masked: false },
    { label: "Buyer", value: "L. F•••", masked: true },
    { label: "Buyer email", value: "l•••••@n•••••.com", masked: true },
  ],
  omittedPayloadFields: 3,
  discard: null,
  history: [],
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
