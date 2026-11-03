import {
  type CloseDataRequestInput,
  type CreateDataRequestInput,
  DATA_REQUEST_PRODUCTS,
  type DataRequestError,
  type DataRequestProduct,
  type ExtendDataRequestInput,
  type PatchDataRequestInput,
  dataRequestDueOn,
  daysLate,
  downloadReference,
  extendedDueOn,
  londonCalendarDate,
} from "@auction/identity-contracts";
import type {
  ContinuationDecision,
  DataRequestAuditEntry,
  ManualDecision,
  ManualRequestChange,
  ManualRequestRow,
  NewManualRequest,
  Refusal,
} from "./data-request.ports.js";
import type { SubjectExportRow } from "./subject-export.ports.js";

/**
 * The rules for requests for a copy of someone's data, kept free of storage so each can be
 * tested on its own. A rule looks at the request as it is now and either returns the change and
 * its audit rows or says why it is refused; the repository applies the answer under a row lock.
 *
 * Dates are London calendar dates. `today` is the London day the call is made on.
 */

export type RuleContext = { today: string; now: Date };

const refuse = (error: DataRequestError): Refusal => ({ ok: false, error });

/** Common checks for any change to a manual request: not about the actor, and not edited from a stale copy. */
function guardChange(
  row: ManualRequestRow,
  input: { actorSubjectId: string; version: number },
): Refusal | null {
  if (row.subjectId !== null && row.subjectId === input.actorSubjectId)
    return refuse("own_request");
  if (row.version !== input.version) return refuse("stale_version");
  if (row.status === "closed") return refuse("already_closed");
  return null;
}

/** A request about the signed-in staff member: they may look, but another person must handle it. */
export function isOwnRequest(subjectId: string | null, actorSubjectId: string): boolean {
  return subjectId !== null && subjectId === actorSubjectId;
}

/** The date the deadline is measured against: the extended one when the request was extended. */
export function effectiveDueOn(
  row: Pick<ManualRequestRow, "dueOn" | "extendedDueOn">,
): string | null {
  return row.extendedDueOn ?? row.dueOn;
}

export type CreatePlan =
  | { ok: true; request: NewManualRequest; audit: DataRequestAuditEntry[] }
  | Refusal;

/** Logs a request. "Confirmed" starts the clock on the received date; otherwise it waits for ID. */
export function planCreate(
  input: CreateDataRequestInput,
  ctx: RuleContext & { accountExists: boolean },
): CreatePlan {
  if (input.person.kind === "account") {
    if (isOwnRequest(input.person.subjectId, input.actorSubjectId)) return refuse("own_request");
    if (!ctx.accountExists) return refuse("account_not_found");
  }
  if (input.receivedOn > ctx.today) return refuse("received_in_future");
  const started = input.identity === "confirmed";
  const dueOn = started ? dataRequestDueOn(input.receivedOn) : null;
  return {
    ok: true,
    audit: [
      {
        event: "data_request.logged",
        detail: {
          reason: input.reason,
          channel: input.channel,
          products: input.products,
          receivedOn: input.receivedOn,
          identity: input.identity,
          dueOn,
        },
      },
    ],
    request: {
      subjectId: input.person.kind === "account" ? input.person.subjectId : null,
      contactName: input.person.kind === "contact" ? input.person.name : null,
      contactDetail: input.person.kind === "contact" ? input.person.detail : null,
      reason: input.reason,
      channel: input.channel,
      products: input.products,
      productGathered: {},
      receivedOn: input.receivedOn,
      clockStartedOn: started ? input.receivedOn : null,
      dueOn,
      extendedDueOn: null,
      extensionReason: null,
      extensionNote: null,
      personToldOn: null,
      personToldVia: null,
      status: started ? "in_progress" : "waiting_for_id",
      outcome: null,
      outcomeNote: null,
      complaintRightTold: null,
      closedOn: null,
      closedBy: null,
      linkedExportId: null,
      notes: input.notes ?? null,
      createdBy: input.actorSubjectId,
    },
  };
}

/** Edits notes, scope and contact, ticks a product off, or starts the clock when proof of ID arrives. */
export function planPatch(
  row: ManualRequestRow,
  input: PatchDataRequestInput,
  ctx: RuleContext,
): ManualDecision {
  const guard = guardChange(row, input);
  if (guard) return guard;

  const change: ManualRequestChange = {};
  const audit: Extract<ManualDecision, { ok: true }>["audit"] = [];

  if (input.idReceivedOn !== undefined) {
    if (row.status !== "waiting_for_id") return refuse("not_waiting_for_id");
    if (input.idReceivedOn > ctx.today) return refuse("received_in_future");
    if (input.idReceivedOn < row.receivedOn) return refuse("date_before_received");
    const dueOn = dataRequestDueOn(input.idReceivedOn);
    change.status = "in_progress";
    change.clockStartedOn = input.idReceivedOn;
    change.dueOn = dueOn;
    audit.push({
      event: "data_request.clock_started",
      detail: { clockStartedOn: input.idReceivedOn, dueOn },
    });
  }

  if (input.gathered !== undefined) {
    const { product, done } = input.gathered;
    if (row.status === "waiting_for_id" && change.status === undefined) {
      return refuse("waiting_for_id");
    }
    if (!row.products.includes(product)) return refuse("product_not_in_scope");
    const gathered = { ...row.productGathered };
    if (done) {
      gathered[product] = { at: ctx.now.toISOString(), by: input.actorSubjectId };
    } else {
      delete gathered[product];
    }
    change.productGathered = gathered;
    audit.push({
      event: done ? "data_request.product_gathered" : "data_request.product_ungathered",
      detail: { product },
    });
  }

  if (input.products !== undefined) {
    const kept = input.products;
    const dropsGathered = Object.keys(row.productGathered).some(
      (product) => !kept.includes(product as DataRequestProduct),
    );
    if (dropsGathered) return refuse("product_already_gathered");
    change.products = kept;
    audit.push({ event: "data_request.scope_changed", detail: { products: kept } });
  }

  if (input.contactName !== undefined || input.contactDetail !== undefined) {
    if (row.subjectId !== null || row.contactClearedAt !== null)
      return refuse("contact_not_editable");
    if (input.contactName !== undefined) change.contactName = input.contactName;
    if (input.contactDetail !== undefined) change.contactDetail = input.contactDetail;
    audit.push({ event: "data_request.contact_edited" });
  }

  if (input.notes !== undefined) {
    change.notes = input.notes === "" ? null : input.notes;
    audit.push({ event: "data_request.notes_edited" });
  }

  return { ok: true, change, audit };
}

/**
 * Article 12(3): 1 or 2 more months for a complex request or several requests from one person.
 * Only while open, only once, and only if the person was told on or before the original due date
 * and the original due date has not passed.
 */
export function planExtend(
  row: ManualRequestRow,
  input: ExtendDataRequestInput,
  ctx: RuleContext,
): ManualDecision {
  const guard = guardChange(row, input);
  if (guard) return guard;
  if (row.dueOn === null) return refuse("waiting_for_id");
  if (row.extendedDueOn !== null) return refuse("already_extended");
  if (ctx.today > row.dueOn) return refuse("extension_after_due_date");
  if (input.personToldOn > row.dueOn) return refuse("person_told_after_due_date");
  if (input.personToldOn > ctx.today) return refuse("told_in_future");

  const newDueOn = extendedDueOn(row.dueOn, input.months);
  return {
    ok: true,
    change: {
      extendedDueOn: newDueOn,
      extensionReason: input.reason,
      extensionNote: input.note,
      personToldOn: input.personToldOn,
      personToldVia: input.personToldVia,
    },
    audit: [
      {
        event: "data_request.extended",
        detail: {
          months: input.months,
          reason: input.reason,
          originalDueOn: row.dueOn,
          extendedDueOn: newDueOn,
          personToldOn: input.personToldOn,
          personToldVia: input.personToldVia,
        },
      },
    ],
  };
}

/** Outcomes that say a copy was dealt with, so the clock must have started. */
const NEEDS_STARTED_CLOCK = new Set(["sent", "sent_partial", "nothing_held"]);

/**
 * Closes with an outcome. A refusal needs its reason and confirmation that the person was told
 * they may complain to the ICO (also enforced by the input schema, repeated here because this is
 * the rule). Whether the answer was on time is worked out from the due date and recorded.
 */
export function planClose(
  row: ManualRequestRow,
  input: CloseDataRequestInput,
  ctx: RuleContext,
): ManualDecision {
  const guard = guardChange(row, input);
  if (guard) return guard;
  if (row.dueOn === null && NEEDS_STARTED_CLOCK.has(input.outcome)) {
    return refuse("waiting_for_id");
  }
  if (input.outcome === "sent_partial" && !input.note) return refuse("exemption_required");
  if (input.outcome === "refused") {
    if (!input.note) return refuse("refusal_reason_required");
    if (input.complaintRightTold !== true) return refuse("complaint_right_required");
  }
  const dueOn = effectiveDueOn(row);
  const late = dueOn === null ? null : daysLate(dueOn, ctx.today);
  return {
    ok: true,
    change: {
      status: "closed",
      outcome: input.outcome,
      outcomeNote: input.note ?? null,
      complaintRightTold: input.outcome === "refused" ? true : null,
      closedOn: ctx.today,
      closedBy: input.actorSubjectId,
    },
    audit: [
      {
        event: "data_request.closed",
        detail: {
          outcome: input.outcome,
          daysLate: late,
          onTime: late === null ? null : late === 0,
          complaintRightTold: input.outcome === "refused" ? true : null,
        },
      },
    ],
  };
}

/**
 * Takes over a download that is delayed or failed. The new manual request keeps the original
 * received and due dates, so the clock never resets, and one download is continued once.
 */
export function planContinue(
  download: SubjectExportRow,
  alreadyContinued: boolean,
  actorSubjectId: string,
  ctx: RuleContext,
): ContinuationDecision {
  if (isOwnRequest(download.subjectId, actorSubjectId)) return refuse("own_request");
  if (alreadyContinued) return refuse("already_continued");
  if (download.status !== "delayed" && download.status !== "failed") {
    return refuse("continue_not_allowed");
  }
  const reference = downloadReference(download.id);
  const receivedOn = londonCalendarDate(download.requestedAt);
  const dueOn = londonCalendarDate(download.dueAt);
  const gathered: ManualRequestRow["productGathered"] = {};
  for (const product of DATA_REQUEST_PRODUCTS) {
    if (download.productProgress[product] === "done") {
      gathered[product] = { at: ctx.now.toISOString(), by: "system" };
    }
  }
  return {
    ok: true,
    plan: {
      request: {
        subjectId: download.subjectId,
        contactName: null,
        contactDetail: null,
        reason: "full_copy",
        channel: "other",
        products: [...DATA_REQUEST_PRODUCTS],
        productGathered: gathered,
        receivedOn,
        clockStartedOn: receivedOn,
        dueOn,
        extendedDueOn: null,
        extensionReason: null,
        extensionNote: null,
        personToldOn: null,
        personToldVia: null,
        status: "in_progress",
        outcome: null,
        outcomeNote: null,
        complaintRightTold: null,
        closedOn: null,
        closedBy: null,
        linkedExportId: download.id,
        notes: `Continued from ${reference}`,
        createdBy: actorSubjectId,
      },
      audit: [
        {
          event: "data_request.logged",
          detail: { continuedFrom: reference, receivedOn, dueOn },
        },
      ],
      exportAudit: {
        event: "data_export.continued_manually",
        detail: { actorSubjectId },
      },
    },
  };
}
