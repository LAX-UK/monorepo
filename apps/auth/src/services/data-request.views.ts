import {
  type DataRequestProduct,
  type DataRequestRecord,
  type DataRequestView,
  SUBJECT_EXPORT_PRODUCTS,
  type SubjectExportStatus,
  daysLate,
  dueState,
  formatDeviceLabel,
  maskContact,
  maskContactEmail,
} from "@auction/identity-contracts";
import type { MergedRequestRow, RecordSource } from "./data-request.ports.js";
import { isOwnRequest } from "./data-request.rules.js";

/** The person as the list shows them: always masked, never a name. */
export function personLabel(
  row: Pick<MergedRequestRow, "email" | "contactDetail" | "subjectId">,
): string {
  if (row.email) return maskContactEmail(row.email);
  if (row.contactDetail) return maskContact(row.contactDetail);
  return row.subjectId === null ? "Details cleared" : "Unknown";
}

/** One row of the list. The days left come from the shared clock, so the list, badge and record agree. */
export function toRequestView(row: MergedRequestRow, today: string): DataRequestView {
  const base = {
    reference: row.reference,
    personLabel: personLabel(row),
    hasAccount: row.subjectId !== null,
    products: row.products,
    productsDone: { done: row.productsDone, total: row.products.length },
    requestedOn: row.requestedOn,
    dueOn: row.dueOn,
    extended: row.extended,
    due: row.open ? dueState(row.dueOn, today) : { state: "none" as const, daysLeft: null },
  };
  if (row.kind === "download") {
    return {
      ...base,
      kind: "download",
      status: row.status as SubjectExportStatus,
      continuedAs: row.continuedAs,
    };
  }
  return {
    ...base,
    kind: "manual",
    status: row.status as "waiting_for_id" | "in_progress" | "closed",
    reason: row.reason ?? "other",
    channel: row.channel ?? "other",
    outcome: row.outcome,
    daysLate:
      row.dueOn !== null && row.answeredOn !== null ? daysLate(row.dueOn, row.answeredOn) : null,
  };
}

const PRIMITIVE = new Set(["string", "number", "boolean"]);

/** Audit detail is ids, dates and codes; anything else is dropped before it leaves Identity. */
function primitiveDetail(
  detail: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (value === null || PRIMITIVE.has(typeof value))
      out[key] = value as string | number | boolean | null;
  }
  return out;
}

/** The record page: the full person, the steps, the extension, the file facts and the timeline. */
export function toRecord(
  source: RecordSource,
  actorSubjectId: string,
  today: string,
): DataRequestRecord {
  const { summary, manual, download, account } = source;
  const name = (id: string | null) =>
    id === null ? null : id === "system" ? "System" : (source.actorNames.get(id) ?? null);

  const steps: DataRequestRecord["steps"] = download
    ? SUBJECT_EXPORT_PRODUCTS.map((product) => ({
        product,
        state: download.productProgress[product],
        gatheredAt: null,
        gatheredBy: null,
        records: source.collectedRecords[product] ?? null,
      }))
    : (manual?.products ?? []).map((product: DataRequestProduct) => {
        const gathered = manual?.productGathered[product];
        return {
          product,
          state: gathered ? ("done" as const) : ("waiting" as const),
          gatheredAt: gathered?.at ?? null,
          gatheredBy: name(gathered?.by ?? null),
          records: null,
        };
      });

  return {
    request: toRequestView(summary, today),
    person: {
      name: account?.name ?? manual?.contactName ?? null,
      email: account?.email ?? null,
      contact: manual?.contactDetail ?? null,
      hasAccount: account !== null,
      joinedOn: account?.joinedOn ?? null,
      accountStatus: account?.status ?? null,
    },
    ownRequest: isOwnRequest(summary.subjectId, actorSubjectId),
    version: manual?.version ?? 0,
    notes: manual?.notes ?? null,
    steps,
    extension:
      manual?.extendedDueOn && manual.dueOn && manual.extensionReason && manual.personToldOn
        ? {
            originalDueOn: manual.dueOn,
            extendedDueOn: manual.extendedDueOn,
            reason: manual.extensionReason as "complex" | "multiple_requests",
            note: manual.extensionNote ?? "",
            personToldOn: manual.personToldOn,
            personToldVia: (manual.personToldVia ?? "other") as
              | "email"
              | "post"
              | "phone"
              | "in_person"
              | "other",
          }
        : null,
    outcomeNote: manual?.outcomeNote ?? null,
    complaintRightTold: manual?.complaintRightTold ?? null,
    closedOn: manual?.closedOn ?? null,
    continuedFrom: source.continuedFrom,
    file: download
      ? {
          fileName: download.fileName,
          sizeBytes: download.sizeBytes,
          sha256: download.sha256,
          expiresAt: download.expiresAt?.toISOString() ?? null,
          downloadCount: download.downloadCount,
        }
      : null,
    timeline: source.timeline.map((row) => ({
      at: row.at.toISOString(),
      event: row.event,
      actorName: name(row.actorSubjectId),
      device: row.userAgent ? formatDeviceLabel(row.userAgent) : null,
      detail: primitiveDetail(row.detail),
    })),
  };
}
