import type { CreateDataRequestInput } from "@auction/identity-contracts";
import type { ManualRequestRow } from "./data-request.ports.js";
import type { SubjectExportRow } from "./subject-export.ports.js";

export const STAFF = "staff_hana";
export const PERSON = "user_lena";

/** A manual request in progress, due 2 December 2026. Override only what a test is about. */
export function manualRow(overrides: Partial<ManualRequestRow> = {}): ManualRequestRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    reference: "DR-0001",
    subjectId: PERSON,
    contactName: null,
    contactDetail: null,
    contactClearedAt: null,
    reason: "full_copy",
    channel: "email",
    products: ["account", "bid", "shop"],
    productGathered: {},
    receivedOn: "2026-11-02",
    clockStartedOn: "2026-11-02",
    dueOn: "2026-12-02",
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
    linkedExportId: null,
    notes: null,
    createdBy: STAFF,
    createdAt: new Date("2026-11-02T10:00:00.000Z"),
    updatedAt: new Date("2026-11-02T10:00:00.000Z"),
    version: 3,
    ...overrides,
  };
}

export function downloadRow(overrides: Partial<SubjectExportRow> = {}): SubjectExportRow {
  return {
    id: "7f3c1a22-0000-4000-8000-000000000000",
    subjectId: PERSON,
    status: "delayed",
    productProgress: { account: "done", bid: "retrying", shop: "waiting" },
    requestedAt: new Date("2026-10-20T14:02:00.000Z"),
    dueAt: new Date("2026-11-20T14:02:00.000Z"),
    readyAt: null,
    expiresAt: null,
    deletedAt: null,
    objectKey: null,
    fileName: null,
    sizeBytes: null,
    sha256: null,
    downloadCount: 0,
    lastErrorCode: "bid_unavailable",
    deadlineAlertTier: 0,
    ...overrides,
  };
}

export function newRequestInput(
  overrides: Partial<CreateDataRequestInput> = {},
): CreateDataRequestInput {
  return {
    actorSubjectId: STAFF,
    person: { kind: "account", subjectId: PERSON },
    reason: "full_copy",
    channel: "email",
    receivedOn: "2026-11-02",
    identity: "confirmed",
    products: ["account", "bid", "shop"],
    ...overrides,
  };
}

export const NOV_2 = { today: "2026-11-02", now: new Date("2026-11-02T12:00:00.000Z") };
