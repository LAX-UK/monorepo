import { describe, expect, it } from "vitest";
import type { MergedRequestRow, RecordSource } from "./data-request.ports.js";
import { PERSON, STAFF, downloadRow, manualRow } from "./data-request.test-util.js";
import { personLabel, toRecord, toRequestView } from "./data-request.views.js";

const row = (overrides: Partial<MergedRequestRow> = {}): MergedRequestRow => ({
  kind: "manual",
  reference: "DR-0001",
  subjectId: PERSON,
  email: "lena@north.com",
  contactDetail: null,
  status: "in_progress",
  reason: "full_copy",
  channel: "email",
  products: ["account", "bid"],
  productsDone: 1,
  requestedOn: "2026-11-02",
  dueOn: "2026-12-02",
  extended: false,
  outcome: null,
  answeredOn: null,
  continuedAs: null,
  open: true,
  ...overrides,
});

describe("personLabel", () => {
  it("masks an account's email", () => {
    expect(personLabel(row())).toBe("l•••••@n•••••.com");
  });

  it("masks the contact of a person with no account", () => {
    expect(
      personLabel(row({ subjectId: null, email: null, contactDetail: "lena@north.co.uk" })),
    ).toBe("l•••••@n•••••.uk");
    expect(
      personLabel(row({ subjectId: null, email: null, contactDetail: "12 High Street" })),
    ).toBe("1•••••");
  });

  it("says so when the contact was cleared by retention", () => {
    expect(personLabel(row({ subjectId: null, email: null, contactDetail: null }))).toBe(
      "Details cleared",
    );
  });
});

describe("toRequestView", () => {
  it("counts days on the shared clock and flags overdue", () => {
    expect(toRequestView(row({ dueOn: "2026-11-01" }), "2026-11-02").due).toEqual({
      state: "overdue",
      daysLeft: -1,
    });
    expect(toRequestView(row({ dueOn: null, status: "waiting_for_id" }), "2026-11-02").due).toEqual(
      {
        state: "none",
        daysLeft: null,
      },
    );
  });

  it("shows a download with the manual request that continued it", () => {
    const view = toRequestView(
      row({
        kind: "download",
        reference: "DL-7F3C1A",
        status: "delayed",
        reason: null,
        channel: null,
        continuedAs: "DR-0013",
        open: false,
      }),
      "2026-11-02",
    );
    expect(view).toMatchObject({ kind: "download", continuedAs: "DR-0013" });
  });

  it("computes days late for a closed manual request", () => {
    const view = toRequestView(
      row({
        status: "closed",
        outcome: "sent",
        open: false,
        dueOn: "2026-12-02",
        answeredOn: "2026-12-05",
      }),
      "2026-12-10",
    );
    expect(view).toMatchObject({ kind: "manual", daysLate: 3 });
  });
});

describe("toRecord", () => {
  const source = (overrides: Partial<RecordSource> = {}): RecordSource => ({
    summary: row(),
    manual: manualRow({
      products: ["account", "bid"],
      productGathered: { bid: { at: "2026-11-03T09:00:00.000Z", by: STAFF } },
    }),
    download: null,
    continuedFrom: null,
    account: {
      id: PERSON,
      name: "Lena Fischer",
      email: "lena@north.com",
      joinedOn: "2024-02-01",
      status: "Active",
    },
    timeline: [
      {
        at: new Date("2026-11-02T10:00:00.000Z"),
        event: "data_request.logged",
        actorSubjectId: STAFF,
        userAgent: null,
        detail: { reason: "full_copy", products: ["account", "bid"], dueOn: "2026-12-02" },
      },
      {
        at: new Date("2026-11-02T09:00:00.000Z"),
        event: "data_export.requested",
        actorSubjectId: PERSON,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        detail: { dueAt: "2026-12-02T09:00:00.000Z" },
      },
    ],
    actorNames: new Map([
      [STAFF, "Hana Ito"],
      [PERSON, "Lena Fischer"],
    ]),
    collectedRecords: {},
    ...overrides,
  });

  it("shows the full person on the record only, and who ticked each product", () => {
    const record = toRecord(source(), STAFF, "2026-11-02");
    expect(record.person).toMatchObject({ name: "Lena Fischer", email: "lena@north.com" });
    expect(record.request.personLabel).toBe("l•••••@n•••••.com");
    expect(record.steps).toEqual([
      expect.objectContaining({ product: "account", state: "waiting" }),
      expect.objectContaining({ product: "bid", state: "done", gatheredBy: "Hana Ito" }),
    ]);
  });

  it("flags the staff member's own request as view only", () => {
    expect(toRecord(source(), PERSON, "2026-11-02").ownRequest).toBe(true);
    expect(toRecord(source(), STAFF, "2026-11-02").ownRequest).toBe(false);
  });

  it("shows a device label from the user agent and never an address", () => {
    const record = toRecord(source(), STAFF, "2026-11-02");
    expect(record.timeline.map((entry) => entry.event)).toEqual([
      "data_request.logged",
      "data_export.requested",
    ]);
    expect(record.timeline[1]?.device).toBe("Chrome on macOS");
    expect(JSON.stringify(record)).not.toMatch(/ip_?address|"ip"/i);
  });

  it("drops anything that is not an id, date or code from the audit detail", () => {
    const record = toRecord(
      source({
        timeline: [
          {
            at: new Date("2026-11-02T10:00:00.000Z"),
            event: "data_request.logged",
            actorSubjectId: null,
            userAgent: null,
            detail: { dueOn: "2026-12-02", products: ["account"], nested: { a: 1 } },
          },
        ],
      }),
      STAFF,
      "2026-11-02",
    );
    expect(record.timeline[0]?.detail).toEqual({ dueOn: "2026-12-02" });
  });

  it("shows a download's steps with the records collected, and its file facts without a link", () => {
    const record = toRecord(
      source({
        summary: row({
          kind: "download",
          reference: "DL-7F3C1A",
          status: "ready",
          reason: null,
          channel: null,
          open: false,
        }),
        manual: null,
        download: downloadRow({
          status: "ready",
          fileName: "lax-data.zip",
          sizeBytes: 1024,
          sha256: "a".repeat(64),
          objectKey: "secret/key",
          expiresAt: new Date("2026-11-09T09:00:00.000Z"),
        }),
        collectedRecords: { account: 12 },
      }),
      STAFF,
      "2026-11-02",
    );
    expect(record.steps[0]).toMatchObject({ product: "account", records: 12 });
    expect(record.file).toMatchObject({ fileName: "lax-data.zip", sizeBytes: 1024 });
    expect(JSON.stringify(record)).not.toContain("secret/key");
  });

  it("reports an extension with the original and the new date", () => {
    const record = toRecord(
      source({
        manual: manualRow({
          extendedDueOn: "2027-01-02",
          extensionReason: "complex",
          extensionNote: "Archive",
          personToldOn: "2026-11-20",
          personToldVia: "email",
        }),
      }),
      STAFF,
      "2026-11-02",
    );
    expect(record.extension).toEqual({
      originalDueOn: "2026-12-02",
      extendedDueOn: "2027-01-02",
      reason: "complex",
      note: "Archive",
      personToldOn: "2026-11-20",
      personToldVia: "email",
    });
  });
});
