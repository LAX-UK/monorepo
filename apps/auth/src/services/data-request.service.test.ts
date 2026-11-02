import { describe, expect, it, vi } from "vitest";
import { decodeCursor } from "./data-request.cursor.js";
import type {
  DataRequestReader,
  DataRequestWriter,
  ManualDecision,
  ManualRequestRow,
  MergedRequestRow,
  RecordSource,
} from "./data-request.ports.js";
import { DataRequestService } from "./data-request.service.js";
import {
  PERSON,
  STAFF,
  downloadRow,
  manualRow,
  newRequestInput,
} from "./data-request.test-util.js";

const NOW = new Date("2026-11-02T12:00:00.000Z");

function merged(overrides: Partial<MergedRequestRow> = {}): MergedRequestRow {
  return {
    kind: "manual",
    reference: "DR-0001",
    subjectId: PERSON,
    email: "lena@north.com",
    contactDetail: null,
    status: "in_progress",
    reason: "full_copy",
    channel: "email",
    products: ["account", "bid", "shop"],
    productsDone: 1,
    requestedOn: "2026-11-02",
    dueOn: "2026-11-05",
    extended: false,
    outcome: null,
    answeredOn: null,
    continuedAs: null,
    open: true,
    ...overrides,
  };
}

function setup(rows: MergedRequestRow[] = [], current: ManualRequestRow | null = manualRow()) {
  const list = vi.fn(async (_filter: unknown) => rows);
  const reader: DataRequestReader = {
    list,
    summary: vi.fn(async () => ({
      open: 3,
      dueSoon: 1,
      overdue: 1,
      waitingForId: 0,
      answeredLast12Months: { answered: 4, onTime: 3 },
    })),
    findRecord: vi.fn(
      async (reference: string): Promise<RecordSource | null> =>
        reference === "DR-0001" || reference === "DR-0002"
          ? {
              summary: merged({ reference }),
              manual: current,
              download: null,
              continuedFrom: null,
              account: null,
              timeline: [],
              actorNames: new Map(),
              collectedRecords: {},
            }
          : null,
    ),
    accountExists: vi.fn(async (id: string) => id === PERSON),
  };
  const applied: { audit: unknown; actor: string }[] = [];
  const writer: DataRequestWriter = {
    create: vi.fn(async (request, audit) => {
      applied.push({ audit, actor: request.createdBy });
      return manualRow({ reference: "DR-0002" });
    }),
    mutate: vi.fn(
      async (reference: string, actor: string, decide: (r: ManualRequestRow) => ManualDecision) => {
        if (!current || reference !== current.reference) return null;
        const decision = decide(current);
        if (!decision.ok) return decision;
        applied.push({ audit: decision.audit, actor });
        return { ok: true as const, row: { ...current, ...decision.change } };
      },
    ),
    continueDownload: vi.fn(async (reference: string, actor: string, decide) => {
      if (reference !== "DL-7F3C1A") return null;
      const decision = decide(downloadRow(), false);
      if (!decision.ok) return decision;
      applied.push({ audit: decision.plan.audit, actor });
      return { ok: true as const, row: manualRow({ reference: "DR-0002" }) };
    }),
    clearContacts: vi.fn(async () => []),
  };
  return {
    service: new DataRequestService({ reader, writer }, () => NOW),
    reader,
    writer,
    list,
    applied,
  };
}

const QUERY = { view: "open", sort: "due" } as const;

describe("DataRequestService reads", () => {
  it("masks the person in every row and reports days left from the shared clock", async () => {
    const { service } = setup([merged()]);
    const { items } = await service.list(QUERY);
    expect(items[0]).toMatchObject({
      reference: "DR-0001",
      personLabel: "l•••••@n•••••.com",
      due: { state: "due_soon", daysLeft: 3 },
    });
    expect(JSON.stringify(items)).not.toContain("lena@north.com");
  });

  it("asks for one more row than a page to know whether there is a next page", async () => {
    const { service, list } = setup([]);
    await service.list(QUERY);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 51, today: "2026-11-02" }));
  });

  it("returns a cursor for the next page only when there are more rows", async () => {
    const rows = Array.from({ length: 51 }, (_, i) =>
      merged({ reference: `DR-${String(i + 1).padStart(4, "0")}`, dueOn: "2026-11-05" }),
    );
    const { service } = setup(rows);
    const page = await service.list(QUERY);
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor("due", page.nextCursor ?? "")).toEqual({
      key: "2026-11-05",
      reference: "DR-0050",
    });
    expect((await setup(rows.slice(0, 50)).service.list(QUERY)).nextCursor).toBeNull();
  });

  it("passes the decoded cursor to the reader and refuses one made for another sort", async () => {
    const rows = Array.from({ length: 51 }, (_, i) =>
      merged({ reference: `DR-${String(i + 1).padStart(4, "0")}` }),
    );
    const first = await setup(rows).service.list(QUERY);
    const { service, list } = setup([]);
    await service.list({ ...QUERY, cursor: first.nextCursor ?? "" });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ after: { key: "2026-11-05", reference: "DR-0050" } }),
    );
    await expect(
      service.list({ ...QUERY, sort: "requested", cursor: first.nextCursor ?? "" }),
    ).rejects.toThrow("Invalid data request cursor");
  });

  it("shows no deadline for a request that is no longer open", async () => {
    const { service } = setup([
      merged({ open: false, status: "closed", outcome: "sent", answeredOn: "2026-11-04" }),
    ]);
    const { items } = await service.list({ view: "closed", sort: "due" });
    expect(items[0]).toMatchObject({ due: { state: "none", daysLeft: null }, daysLate: 0 });
  });

  it("opens a record and says when the signed-in person is the subject", async () => {
    const { service } = setup([], manualRow({ subjectId: STAFF }));
    // The merged summary says the subject is the person; own-ness is judged against the summary.
    const own = await service.record("DR-0001", PERSON);
    expect(own).toMatchObject({ ok: true, value: { ownRequest: true } });
    const other = await service.record("DR-0001", STAFF);
    expect(other).toMatchObject({ ok: true, value: { ownRequest: false } });
    expect(await service.record("DR-9999", STAFF)).toEqual({ ok: false, error: "not_found" });
  });

  it("passes the summary through", async () => {
    expect(await setup().service.summary()).toMatchObject({ open: 3, overdue: 1 });
  });
});

describe("DataRequestService writes", () => {
  it("logs a request, audits it with the actor and answers with its record", async () => {
    const { service, applied } = setup();
    const result = await service.create(newRequestInput());
    expect(result).toMatchObject({ ok: true, value: { request: { reference: "DR-0002" } } });
    expect(applied[0]).toMatchObject({ actor: STAFF });
  });

  it("refuses an account that does not exist and a request about the actor, without writing", async () => {
    const { service, writer } = setup();
    expect(
      await service.create(newRequestInput({ person: { kind: "account", subjectId: "ghost" } })),
    ).toEqual({ ok: false, error: "account_not_found" });
    expect(
      await service.create(newRequestInput({ person: { kind: "account", subjectId: STAFF } })),
    ).toEqual({ ok: false, error: "own_request" });
    expect(writer.create).not.toHaveBeenCalled();
  });

  it("applies a rule under the writer and audits the actor", async () => {
    const { service, applied } = setup();
    const result = await service.close("DR-0001", {
      actorSubjectId: STAFF,
      version: 3,
      outcome: "sent",
    });
    expect(result.ok).toBe(true);
    expect(applied[0]).toMatchObject({ actor: STAFF });
  });

  it("passes a rule's refusal through and a missing request as not found", async () => {
    const { service } = setup();
    expect(
      await service.close("DR-0001", { actorSubjectId: STAFF, version: 1, outcome: "sent" }),
    ).toEqual({ ok: false, error: "stale_version" });
    expect(
      await service.patch("DR-0404", { actorSubjectId: STAFF, version: 3, notes: "x" }),
    ).toEqual({ ok: false, error: "not_found" });
  });

  it("does not change a download with the manual routes", async () => {
    const { service, writer } = setup();
    expect(
      await service.extend("DL-7F3C1A", {
        actorSubjectId: STAFF,
        version: 1,
        months: 1,
        reason: "complex",
        note: "x",
        personToldOn: "2026-11-01",
        personToldVia: "email",
      }),
    ).toEqual({ ok: false, error: "not_manual" });
    expect(writer.mutate).not.toHaveBeenCalled();
  });

  it("continues a download and answers with the new manual request's record", async () => {
    const { service, applied } = setup();
    const result = await service.continueDownload("DL-7F3C1A", STAFF);
    expect(result).toMatchObject({ ok: true, value: { request: { reference: "DR-0002" } } });
    expect(applied[0]).toMatchObject({ actor: STAFF });
    expect(await service.continueDownload("DL-000000", STAFF)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await service.continueDownload("DR-0001", STAFF)).toEqual({
      ok: false,
      error: "continue_not_allowed",
    });
  });
});
