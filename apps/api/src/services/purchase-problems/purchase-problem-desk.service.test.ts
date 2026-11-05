import type {
  IPurchaseProblemDeskRepository,
  IPurchaseProblemNoteRepository,
  PurchaseProblemChange,
  PurchaseProblemDeskRecord,
  PurchaseProblemNoteRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { PurchaseProblemDeskService } from "./purchase-problem-desk.service.js";

const ID = "3f2a9c1e-7b4d-4e0a-9d1f-5c6b7a8e9f00";
const NOW = new Date("2026-11-04T10:00:00Z");

function record(over: Partial<PurchaseProblemDeskRecord> = {}): PurchaseProblemDeskRecord {
  return {
    id: ID,
    status: "open",
    category: "damaged",
    message: "The frame arrived cracked.",
    version: 3,
    assignedToUserId: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: new Date("2026-11-01T09:00:00Z"),
    updatedAt: new Date("2026-11-01T09:00:00Z"),
    buyer: { legalEntityId: "le-1", name: "Ada Lovelace", reportedByUserId: "u-buyer" },
    lot: { id: "lot-1", title: "Pool study", lotNumber: 12, saleId: "sale-1", saleTitle: "Autumn" },
    payment: { id: "pay-1", status: "captured", amountMinor: 480_000 },
    ...over,
  };
}

function setup(initial: PurchaseProblemDeskRecord = record(), staff = ["staff-2"]) {
  let current = initial;
  const notes: PurchaseProblemNoteRecord[] = [];
  const published: Array<{ eventType: string; payload: unknown }> = [];
  const problems: IPurchaseProblemDeskRepository = {
    list: vi.fn().mockResolvedValue({ rows: [current], total: 1 }),
    counts: vi.fn().mockResolvedValue({ open: 1, in_progress: 0, resolved: 0 }),
    salesWithReports: vi.fn().mockResolvedValue([{ id: "sale-1", title: "Autumn" }]),
    findById: vi.fn(async (id: string) => (id === current.id ? current : null)),
    updateInTransaction: vi.fn(
      async (_tx, _id: string, version: number, change: PurchaseProblemChange) => {
        if (version !== current.version) return null;
        current = {
          ...current,
          ...(change.status ? { status: change.status } : {}),
          ...(change.assignedToUserId !== undefined
            ? { assignedToUserId: change.assignedToUserId }
            : {}),
          ...(change.resolved
            ? { resolvedAt: change.resolved.at, resolvedByUserId: change.resolved.byUserId }
            : {}),
          version: current.version + 1,
        };
        return current;
      },
    ),
  };
  const noteRepo: IPurchaseProblemNoteRepository = {
    addInTransaction: vi.fn(async (_tx, input) => {
      const note = { id: `n${notes.length}`, createdAt: NOW, ...input };
      notes.push(note);
      return note;
    }),
    listForProblem: vi.fn(async () => notes),
  };
  const events = {
    withTx: () => ({
      publish: vi.fn(async (event: { eventType: string; payload: unknown }) => {
        published.push(event);
      }),
    }),
  };
  const service = new PurchaseProblemDeskService({
    problems,
    notes: noteRepo,
    assignees: {
      isStaff: async (id: string) => staff.includes(id),
      list: async () => [{ id: "staff-2", name: "Sofia Okafor" }],
    },
    transactionRunner: {
      runInTransaction: async (run: (tx: never) => unknown) => run({} as never),
    },
    events: events as never,
    now: () => NOW,
  } as never);
  return { service, problems, notes, published };
}

describe("PurchaseProblemDeskService.list", () => {
  it("returns a page with the status counts and the sales that have reports", async () => {
    const { service, problems } = setup();
    const page = await service.list({ status: "open", page: 2, limit: 10, q: "ada" });
    expect(problems.list).toHaveBeenCalledWith({
      status: "open",
      search: "ada",
      limit: 10,
      offset: 10,
    });
    expect(problems.counts).toHaveBeenCalledWith({ search: "ada" });
    expect(page).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      counts: { open: 1, in_progress: 0, resolved: 0 },
      sales: [{ id: "sale-1", title: "Autumn" }],
    });
    expect(page.items[0]).toMatchObject({
      reference: "PR-3F2A9C1E",
      buyerName: "Ada Lovelace",
      raisedAt: "2026-11-01T09:00:00.000Z",
    });
    expect(page.items[0]).not.toHaveProperty("message");
  });
});

describe("PurchaseProblemDeskService.detail", () => {
  it("returns the report with the buyer's message, payment, notes and next statuses", async () => {
    const { service } = setup();
    const view = await service.detail(ID);
    expect(view).toMatchObject({
      message: "The frame arrived cracked.",
      version: 3,
      payment: { id: "pay-1", amountMinor: 480_000 },
      nextStatuses: ["in_progress", "resolved"],
      notes: [],
    });
  });

  it("is null for a report that does not exist", async () => {
    expect(await setup().service.detail("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("PurchaseProblemDeskService.update", () => {
  it("takes a report on and records who has it", async () => {
    const { service, published } = setup();
    const result = await service.update("staff-1", ID, {
      version: 3,
      status: "in_progress",
      assignedToUserId: "staff-2",
    });
    expect(result).toMatchObject({
      ok: true,
      problem: { status: "in_progress", assignedToUserId: "staff-2", version: 4 },
    });
    expect(published.map((event) => event.eventType)).toEqual([
      "purchase_problem.assigned",
      "purchase_problem.status_changed",
    ]);
    expect(published[0]?.payload).toEqual({
      problemId: ID,
      assignedToUserId: "staff-2",
      previousAssignedToUserId: null,
    });
  });

  it("resolves with a note, names the resolver and keeps the note", async () => {
    const { service, notes, published } = setup(record({ status: "in_progress" }));
    const result = await service.update("staff-1", ID, {
      version: 3,
      status: "resolved",
      note: "Refunded in full.",
    });
    expect(result).toMatchObject({
      ok: true,
      problem: {
        status: "resolved",
        resolvedByUserId: "staff-1",
        resolvedAt: NOW.toISOString(),
        nextStatuses: [],
        notes: [{ body: "Refunded in full.", authorUserId: "staff-1" }],
      },
    });
    expect(notes).toHaveLength(1);
    expect(published.map((event) => event.eventType)).toEqual([
      "purchase_problem.status_changed",
      "purchase_problem.note_added",
    ]);
    // The event never carries the note or the buyer's words.
    expect(JSON.stringify(published)).not.toContain("Refunded");
  });

  it("refuses to resolve without a note", async () => {
    const { service, problems } = setup();
    expect(await service.update("staff-1", ID, { version: 3, status: "resolved" })).toEqual({
      ok: false,
      error: "resolution_note_required",
    });
    expect(problems.updateInTransaction).not.toHaveBeenCalled();
  });

  it("refuses a move the status does not allow", async () => {
    const { service } = setup(record({ status: "resolved", resolvedAt: NOW }));
    expect(await service.update("staff-1", ID, { version: 3, status: "open" })).toEqual({
      ok: false,
      error: "not_allowed",
    });
  });

  it("refuses to hand over a resolved report and to hand it to someone who is not staff", async () => {
    const resolved = setup(record({ status: "resolved", resolvedAt: NOW }));
    expect(
      await resolved.service.update("staff-1", ID, { version: 3, assignedToUserId: "staff-2" }),
    ).toEqual({ ok: false, error: "not_allowed" });
    const { service } = setup();
    expect(
      await service.update("staff-1", ID, { version: 3, assignedToUserId: "stranger" }),
    ).toEqual({ ok: false, error: "assignee_invalid" });
  });

  it("answers stale_version with the current version, before and during the write", async () => {
    const { service, problems } = setup();
    expect(await service.update("staff-1", ID, { version: 2, note: "x" })).toEqual({
      ok: false,
      error: "stale_version",
      currentVersion: 3,
    });
    vi.mocked(problems.findById).mockResolvedValueOnce(record());
    vi.mocked(problems.updateInTransaction).mockResolvedValueOnce(null);
    expect(await service.update("staff-1", ID, { version: 3, note: "x" })).toMatchObject({
      ok: false,
      error: "stale_version",
    });
  });

  it("answers not found, and unchanged when the assignee is already the one named", async () => {
    const { service } = setup(record({ assignedToUserId: "staff-2" }));
    expect(
      await service.update("staff-1", "00000000-0000-4000-8000-000000000000", {
        version: 1,
        note: "x",
      }),
    ).toEqual({ ok: false, error: "purchase_problem_not_found" });
    expect(
      await service.update("staff-1", ID, { version: 3, assignedToUserId: "staff-2" }),
    ).toEqual({ ok: false, error: "unchanged" });
  });

  it("adds a note on its own and lets staff note a resolved report", async () => {
    const { service, published } = setup(record({ status: "resolved", resolvedAt: NOW }));
    const result = await service.update("staff-1", ID, { version: 3, note: "Buyer thanked us." });
    expect(result).toMatchObject({ ok: true, problem: { notes: [{ body: "Buyer thanked us." }] } });
    expect(published.map((event) => event.eventType)).toEqual(["purchase_problem.note_added"]);
  });
});

describe("PurchaseProblemDeskService.assignees", () => {
  it("names the staff a report may be given to", async () => {
    expect(await setup().service.assignees()).toEqual([{ id: "staff-2", name: "Sofia Okafor" }]);
  });
});
