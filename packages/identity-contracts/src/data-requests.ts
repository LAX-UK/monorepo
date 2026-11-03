import { z } from "zod";
import { calendarDateSchema, dueStateSchema } from "./data-request-dates.js";
import {
  SUBJECT_EXPORT_PRODUCTS,
  SUBJECT_EXPORT_STATUSES,
  subjectExportDateSchema,
} from "./subject-export.js";

/**
 * Staff's view of every request for a copy of someone's data: the automatic downloads and the
 * requests staff log themselves, on one clock. Identity owns both kinds; the Bid API proxies
 * these routes for Bid admin with a machine credential of its own scope, so a leaked lifecycle
 * or export credential cannot list requests.
 */

/** Machine-credential scope for these routes. Separate from `identity.lifecycle` and `subject_export`. */
export const DATA_REQUESTS_MACHINE_SCOPE = "data_requests.staff";

/** Under `/internal`; the Bid API appends the sub-route. */
export const DATA_REQUESTS_ROUTE = "/identity/data-requests";

export function dataRequestsPath(...segments: string[]): string {
  return [DATA_REQUESTS_ROUTE, ...segments.map(encodeURIComponent)].join("/");
}

// Vocabulary --------------------------------------------------------------------------------

export const DATA_REQUEST_PRODUCTS = SUBJECT_EXPORT_PRODUCTS;
export const dataRequestProductSchema = z.enum(DATA_REQUEST_PRODUCTS);
export type DataRequestProduct = z.infer<typeof dataRequestProductSchema>;

export const DATA_REQUEST_KINDS = ["download", "manual"] as const;
export const dataRequestKindSchema = z.enum(DATA_REQUEST_KINDS);
export type DataRequestKind = z.infer<typeof dataRequestKindSchema>;

export const DATA_REQUEST_REASONS = [
  "full_copy",
  "after_deletion",
  "guest_orders",
  "other",
] as const;
export const dataRequestReasonSchema = z.enum(DATA_REQUEST_REASONS);
export type DataRequestReason = z.infer<typeof dataRequestReasonSchema>;

export const DATA_REQUEST_CHANNELS = [
  "support_form",
  "email",
  "post",
  "phone",
  "in_person",
  "other",
] as const;
export const dataRequestChannelSchema = z.enum(DATA_REQUEST_CHANNELS);
export type DataRequestChannel = z.infer<typeof dataRequestChannelSchema>;

/** How the person can have been told of an extension; a support form is not a way to tell them. */
export const DATA_REQUEST_TOLD_VIA = ["email", "post", "phone", "in_person", "other"] as const;
export const dataRequestToldViaSchema = z.enum(DATA_REQUEST_TOLD_VIA);

export const DATA_REQUEST_MANUAL_STATUSES = ["waiting_for_id", "in_progress", "closed"] as const;
export const dataRequestManualStatusSchema = z.enum(DATA_REQUEST_MANUAL_STATUSES);
export type DataRequestManualStatus = z.infer<typeof dataRequestManualStatusSchema>;

export const DATA_REQUEST_OUTCOMES = [
  "sent",
  "sent_partial",
  "nothing_held",
  "refused",
  "withdrawn",
] as const;
export const dataRequestOutcomeSchema = z.enum(DATA_REQUEST_OUTCOMES);
export type DataRequestOutcome = z.infer<typeof dataRequestOutcomeSchema>;

export const DATA_REQUEST_EXTENSION_REASONS = ["complex", "multiple_requests"] as const;
export const dataRequestExtensionReasonSchema = z.enum(DATA_REQUEST_EXTENSION_REASONS);

export const DATA_REQUEST_VIEWS = ["open", "overdue", "waiting", "closed", "all"] as const;
export const dataRequestListViewSchema = z.enum(DATA_REQUEST_VIEWS);
export type DataRequestListView = z.infer<typeof dataRequestListViewSchema>;

export const DATA_REQUEST_SORTS = ["due", "requested"] as const;
export const DATA_REQUESTS_PAGE_SIZE = 50;

/** Every status a row in the merged list can show, for the Status filter. */
export const DATA_REQUEST_STATUSES = [
  ...SUBJECT_EXPORT_STATUSES,
  ...DATA_REQUEST_MANUAL_STATUSES,
] as const;

/** Notes, extension notes, outcome notes: internal text, never the person's data. */
export const DATA_REQUEST_NOTE_MAX_LENGTH = 2_000;

/** The reference of an automatic download: `DL-` and six characters of its id. */
export function downloadReference(exportId: string): string {
  return `DL-${exportId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

const MANUAL_REFERENCE = /^DR-\d{4,}$/;
const DOWNLOAD_REFERENCE = /^DL-[0-9A-F]{6}$/;

export function isManualReference(value: string): boolean {
  return MANUAL_REFERENCE.test(value);
}

export function isDownloadReference(value: string): boolean {
  return DOWNLOAD_REFERENCE.test(value);
}

export const dataRequestReferenceSchema = z
  .string()
  .refine((value) => isManualReference(value) || isDownloadReference(value), {
    message: "Not a request reference",
  });

// Masking -----------------------------------------------------------------------------------

const BULLETS = "•••••";

/** `lena@north.com` becomes `l•••••@n•••••.com`, the rule the Failed jobs screen uses. */
export function maskContactEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return BULLETS;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${email.charAt(0)}${BULLETS}@${host.charAt(0)}${BULLETS}${tld}`;
}

/** An email is masked as one; any other contact (a postal address, a phone number) keeps its first character. */
export function maskContact(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return maskContactEmail(trimmed);
  return trimmed ? `${trimmed.charAt(0)}${BULLETS}` : BULLETS;
}

// Views -------------------------------------------------------------------------------------

const productsSchema = z.array(dataRequestProductSchema);

/** What the list, the nav badge and the schedule share about any request. */
const requestBaseSchema = z.object({
  reference: dataRequestReferenceSchema,
  /** Masked: the list never carries a full email address. */
  personLabel: z.string(),
  hasAccount: z.boolean(),
  products: productsSchema,
  productsDone: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  requestedOn: calendarDateSchema,
  /** The date that counts: the extended one when there is one. Null while waiting for ID. */
  dueOn: calendarDateSchema.nullable(),
  extended: z.boolean(),
  due: dueStateSchema,
});

export const downloadRequestViewSchema = requestBaseSchema.extend({
  kind: z.literal("download"),
  status: z.enum(SUBJECT_EXPORT_STATUSES),
  /** The manual request that took this download over, if staff continued it. */
  continuedAs: z.string().nullable(),
});

export const manualRequestViewSchema = requestBaseSchema.extend({
  kind: z.literal("manual"),
  status: dataRequestManualStatusSchema,
  reason: dataRequestReasonSchema,
  channel: dataRequestChannelSchema,
  outcome: dataRequestOutcomeSchema.nullable(),
  /** Days after the due date the answer went out; 0 when on time. Null until closed. */
  daysLate: z.number().int().nonnegative().nullable(),
});

/** One request, automatic or manual. */
export const dataRequestViewSchema = z.discriminatedUnion("kind", [
  downloadRequestViewSchema,
  manualRequestViewSchema,
]);
export type DataRequestView = z.infer<typeof dataRequestViewSchema>;
export type DownloadRequestView = z.infer<typeof downloadRequestViewSchema>;
export type ManualRequestView = z.infer<typeof manualRequestViewSchema>;

export const dataRequestListSchema = z.object({
  items: z.array(dataRequestViewSchema),
  nextCursor: z.string().nullable(),
});
export type DataRequestList = z.infer<typeof dataRequestListSchema>;

/** Counts for the nav badge, the attention strip and the metric strip. */
export const dataRequestSummarySchema = z.object({
  open: z.number().int().nonnegative(),
  dueSoon: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  waitingForId: z.number().int().nonnegative(),
  /** Requests answered in the last 12 months, and how many of them on time. */
  answeredLast12Months: z.object({
    answered: z.number().int().nonnegative(),
    onTime: z.number().int().nonnegative(),
  }),
});
export type DataRequestSummary = z.infer<typeof dataRequestSummarySchema>;

const productStepSchema = z.object({
  product: dataRequestProductSchema,
  /** Download: the worker's state. Manual: `done` once staff mark it gathered. */
  state: z.enum(["waiting", "collecting", "done", "retrying"]),
  gatheredAt: subjectExportDateSchema.nullable(),
  gatheredBy: z.string().nullable(),
  /** Records collected, from the audit rows; counts only. */
  records: z.number().int().nonnegative().nullable(),
});

const timelineEntrySchema = z.object({
  at: subjectExportDateSchema,
  /** The audit event name, such as `data_export.delayed` or `data_request.extended`. */
  event: z.string(),
  actorName: z.string().nullable(),
  /** "Chrome on macOS" for a person's own action; never an IP address. */
  device: z.string().nullable(),
  /** Ids, dates and codes only, as audited. */
  detail: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

const extensionSchema = z.object({
  originalDueOn: calendarDateSchema,
  extendedDueOn: calendarDateSchema,
  reason: dataRequestExtensionReasonSchema,
  note: z.string(),
  personToldOn: calendarDateSchema,
  personToldVia: dataRequestToldViaSchema,
});

const fileFactsSchema = z.object({
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  sha256: z.string().nullable(),
  expiresAt: subjectExportDateSchema.nullable(),
  downloadCount: z.number().int().nonnegative(),
});

/** The person on the record page, the only place the full details appear. */
const recordPersonSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  /** The contact staff logged for a person with no account. */
  contact: z.string().nullable(),
  hasAccount: z.boolean(),
  joinedOn: calendarDateSchema.nullable(),
  accountStatus: z.string().nullable(),
});

export const dataRequestRecordSchema = z.object({
  request: dataRequestViewSchema,
  person: recordPersonSchema,
  /** The signed-in staff member is the subject: the record opens view only. */
  ownRequest: z.boolean(),
  /** For a stale-edit check on manual requests; 0 for a download. */
  version: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  steps: z.array(productStepSchema),
  extension: extensionSchema.nullable(),
  outcomeNote: z.string().nullable(),
  complaintRightTold: z.boolean().nullable(),
  closedOn: calendarDateSchema.nullable(),
  /** Manual: the download it continued. */
  continuedFrom: z.string().nullable(),
  file: fileFactsSchema.nullable(),
  timeline: z.array(timelineEntrySchema),
});
export type DataRequestRecord = z.infer<typeof dataRequestRecordSchema>;

// Inputs ------------------------------------------------------------------------------------

const actorSchema = z.object({
  /** The staff member acting. Identity refuses an action on a request about this person. */
  actorSubjectId: z.string().min(1),
});

const noteSchema = z.string().trim().min(1).max(DATA_REQUEST_NOTE_MAX_LENGTH);
const productSelectionSchema = z
  .array(dataRequestProductSchema)
  .min(1)
  .refine((products) => new Set(products).size === products.length, {
    message: "Each product once",
  });

export const dataRequestListQuerySchema = z.object({
  view: dataRequestListViewSchema.default("open"),
  status: z.enum(DATA_REQUEST_STATUSES).optional(),
  kind: z.union([dataRequestKindSchema, dataRequestReasonSchema]).optional(),
  product: dataRequestProductSchema.optional(),
  /** A reference or a full email address; never part of one. */
  q: z.string().trim().min(1).max(320).optional(),
  sort: z.enum(DATA_REQUEST_SORTS).default("due"),
  cursor: z.string().min(1).max(512).optional(),
});
export type DataRequestListQuery = z.infer<typeof dataRequestListQuerySchema>;

export const dataRequestRecordQuerySchema = actorSchema;

const personSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("account"), subjectId: z.string().min(1) }),
  z.object({
    kind: z.literal("contact"),
    name: z.string().trim().min(1).max(200),
    detail: z.string().trim().min(1).max(500),
  }),
]);

// Each write has a body schema (what Bid admin sends) and a request schema (what Identity
// receives, with the acting staff member added by the Bid API from the session).

const createFields = z.object({
  person: personSchema,
  reason: dataRequestReasonSchema,
  channel: dataRequestChannelSchema,
  receivedOn: calendarDateSchema,
  /** `confirmed` starts the clock on the received date; `asked_for_proof` waits for it. */
  identity: z.enum(["confirmed", "asked_for_proof"]),
  products: productSelectionSchema,
  notes: noteSchema.optional(),
});
const createNeedsNote = (input: z.infer<typeof createFields>) =>
  input.reason !== "other" || input.notes !== undefined;
const CREATE_NOTE_ISSUE = {
  path: ["notes"],
  message: "A note is required when the reason is Other",
};
export const createDataRequestBodySchema = createFields.refine(createNeedsNote, CREATE_NOTE_ISSUE);
export const createDataRequestSchema = createFields
  .merge(actorSchema)
  .refine(createNeedsNote, CREATE_NOTE_ISSUE);
export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>;

const patchFields = z.object({
  /** The version the editor loaded; a stale one answers 409. */
  version: z.number().int().positive(),
  notes: z.string().trim().max(DATA_REQUEST_NOTE_MAX_LENGTH).optional(),
  products: productSelectionSchema.optional(),
  contactName: z.string().trim().min(1).max(200).optional(),
  contactDetail: z.string().trim().min(1).max(500).optional(),
  /** Mark or unmark one product as gathered. */
  gathered: z.object({ product: dataRequestProductSchema, done: z.boolean() }).optional(),
  /** The day proof of identity arrived: the clock starts then. */
  idReceivedOn: calendarDateSchema.optional(),
});
const patchChangesSomething = (input: z.infer<typeof patchFields>) =>
  input.notes !== undefined ||
  input.products !== undefined ||
  input.contactName !== undefined ||
  input.contactDetail !== undefined ||
  input.gathered !== undefined ||
  input.idReceivedOn !== undefined;
const PATCH_ISSUE = { message: "Nothing to change" };
export const patchDataRequestBodySchema = patchFields.refine(patchChangesSomething, PATCH_ISSUE);
export const patchDataRequestSchema = patchFields
  .merge(actorSchema)
  .refine(patchChangesSomething, PATCH_ISSUE);
export type PatchDataRequestInput = z.infer<typeof patchDataRequestSchema>;

export const extendDataRequestBodySchema = z.object({
  version: z.number().int().positive(),
  months: z.union([z.literal(1), z.literal(2)]),
  reason: dataRequestExtensionReasonSchema,
  note: noteSchema,
  personToldOn: calendarDateSchema,
  personToldVia: dataRequestToldViaSchema,
});
export const extendDataRequestSchema = extendDataRequestBodySchema.merge(actorSchema);
export type ExtendDataRequestInput = z.infer<typeof extendDataRequestSchema>;

const closeFields = z.object({
  version: z.number().int().positive(),
  outcome: dataRequestOutcomeSchema,
  /** The exemption for a partial copy, or the reason for a refusal. */
  note: noteSchema.optional(),
  /** For a refusal: the person was told they may complain to the ICO. */
  complaintRightTold: z.boolean().optional(),
});
type CloseFields = z.infer<typeof closeFields>;
const CLOSE_RULES: {
  check: (input: CloseFields) => boolean;
  issue: { path: string[]; message: string };
}[] = [
  {
    check: (input) => input.outcome !== "sent_partial" || input.note !== undefined,
    issue: { path: ["note"], message: "Name the exemption that applies" },
  },
  {
    check: (input) => input.outcome !== "refused" || input.note !== undefined,
    issue: { path: ["note"], message: "Give the reason for refusing" },
  },
  {
    check: (input) => input.outcome !== "refused" || input.complaintRightTold === true,
    issue: {
      path: ["complaintRightTold"],
      message: "The person must be told they may complain to the ICO",
    },
  },
];
export const closeDataRequestBodySchema = closeFields.superRefine((input, ctx) => {
  for (const { check, issue } of CLOSE_RULES) {
    if (!check(input)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
  }
});
export const closeDataRequestSchema = closeFields.merge(actorSchema).superRefine((input, ctx) => {
  for (const { check, issue } of CLOSE_RULES) {
    if (!check(input)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
  }
});
export type CloseDataRequestInput = z.infer<typeof closeDataRequestSchema>;

export const continueDataRequestSchema = actorSchema;
export type ContinueDataRequestInput = z.infer<typeof continueDataRequestSchema>;

/** Why Identity refused a change; each is a business rule, answered with HTTP 409 or 422. */
export const DATA_REQUEST_ERRORS = [
  "not_found",
  "stale_version",
  "own_request",
  "not_open",
  "already_closed",
  "not_manual",
  "extension_not_allowed",
  "already_extended",
  "extension_after_due_date",
  "person_told_after_due_date",
  "told_in_future",
  "waiting_for_id",
  "not_waiting_for_id",
  "continue_not_allowed",
  "already_continued",
  "received_in_future",
  "date_before_received",
  "account_not_found",
  "product_not_in_scope",
  "product_already_gathered",
  "contact_not_editable",
  "exemption_required",
  "refusal_reason_required",
  "complaint_right_required",
  /** Two downloads share the first six characters of their id; the reference does not say which. */
  "ambiguous_reference",
] as const;
export type DataRequestError = (typeof DATA_REQUEST_ERRORS)[number];
