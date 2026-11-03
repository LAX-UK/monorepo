import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryEnquiryNotes,
  InMemoryMarketingEnquiries,
} from "../../testing/in-memory-marketing-enquiries.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { EnquiryStaffViewer } from "../interfaces/marketing-enquiry-service.js";
import { EnquiryDeskService } from "./enquiry-desk.service.js";

const NOW = new Date("2026-07-27T12:00:00.000Z");

const clientServices: EnquiryStaffViewer = {
  userId: "cs-1",
  readsGeneral: true,
  readsPrivateSale: true,
  canAssign: true,
};
const specialist: EnquiryStaffViewer = {
  userId: "spec-1",
  readsGeneral: false,
  readsPrivateSale: true,
  canAssign: true,
};
const noPrivateAccess: EnquiryStaffViewer = {
  userId: "cs-2",
  readsGeneral: true,
  readsPrivateSale: false,
  canAssign: true,
};

type Seed = {
  intent: "general" | "private_sale_sell" | "press";
  assignedToUserId?: string;
  departmentSlug?: string;
};

async function setup(seeds: Seed[] = []) {
  const enquiries = new InMemoryMarketingEnquiries(() => NOW);
  const notes = new InMemoryEnquiryNotes();
  const publish = vi.fn().mockResolvedValue(undefined);
  const events: IDomainEventSink = { publish, withTx: () => events };
  const transactionRunner = {
    runInTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as ITransactionRunner;
  const staff = new Set(["cs-1", "spec-1", "tom"]);
  const desk = new EnquiryDeskService({
    enquiries,
    notes,
    assignees: { isStaff: async (id) => staff.has(id), list: async () => [] },
    transactionRunner,
    events,
    now: () => NOW,
  });
  for (const seed of seeds) {
    await enquiries.createInTransaction(
      {},
      {
        intent: seed.intent,
        topic: seed.intent === "private_sale_sell" ? "selling" : "press",
        name: "Ada Lovelace",
        email: "ada@example.com",
        message: "A message that is long enough.",
        marketingOptIn: false,
        ...(seed.assignedToUserId ? { assignedToUserId: seed.assignedToUserId } : {}),
        ...(seed.departmentSlug ? { departmentSlug: seed.departmentSlug } : {}),
      },
    );
  }
  return { desk, enquiries, notes, publish };
}

const query = (overrides: Record<string, unknown> = {}) =>
  ({ view: "open", limit: 25, ...overrides }) as never;

describe("EnquiryDeskService visibility", () => {
  it("hides private sale enquiries from roles without private sale access, in the list and by reference", async () => {
    const { desk } = await setup([{ intent: "private_sale_sell" }, { intent: "press" }]);

    const page = await desk.list(noPrivateAccess, query({ view: "all" }));
    expect(page.items.map((i) => i.reference)).toEqual(["E-1002"]);
    expect(await desk.detail(noPrivateAccess, "E-1001")).toBeNull();
    expect(await desk.detail(clientServices, "E-1001")).toMatchObject({ reference: "E-1001" });
  });

  it("hides them even from the person they are assigned to, and refuses their changes", async () => {
    const { desk } = await setup([{ intent: "private_sale_sell", assignedToUserId: "cs-2" }]);
    expect(await desk.detail(noPrivateAccess, "E-1001")).toBeNull();
    expect(
      await desk.update(noPrivateAccess, "cs-2", "E-1001", { version: 1, status: "in_progress" }),
    ).toEqual({ ok: false, error: "enquiry_not_found" });
    expect(
      await desk.markHandled(noPrivateAccess, "3f2a9c1e-7b4d-4e0a-9d1f-000000000001", "cs-2"),
    ).toEqual({
      ok: false,
      error: "enquiry_not_found",
    });
  });

  it("shows a specialist general enquiries only when they are assigned to them", async () => {
    const { desk } = await setup([
      { intent: "press" },
      { intent: "press", assignedToUserId: "spec-1" },
    ]);
    const page = await desk.list(specialist, query({ view: "all" }));
    expect(page.items.map((i) => i.reference)).toEqual(["E-1002"]);
  });
});

describe("EnquiryDeskService list", () => {
  it("masks the email and says whether the sender has an account", async () => {
    const { desk } = await setup([{ intent: "press" }]);
    const [item] = (await desk.list(clientServices, query())).items;
    expect(item).toMatchObject({ maskedEmail: "a•••@example.com", hasAccount: false });
    expect(JSON.stringify(item)).not.toContain("ada@example.com");
  });

  it("answers the assigned-to-me, unassigned and private sales views", async () => {
    const { desk } = await setup([
      { intent: "press", assignedToUserId: "cs-1" },
      { intent: "private_sale_sell" },
      { intent: "press", assignedToUserId: "tom" },
    ]);
    const refs = async (view: string) =>
      (await desk.list(clientServices, query({ view }))).items.map((i) => i.reference);
    expect(await refs("assigned_to_me")).toEqual(["E-1001"]);
    expect(await refs("unassigned")).toEqual(["E-1002"]);
    expect(await refs("private_sales")).toEqual(["E-1002"]);
    expect(await refs("open")).toEqual(["E-1001", "E-1002", "E-1003"]);
  });

  it("filters by assignee, department and kind", async () => {
    const { desk } = await setup([
      { intent: "private_sale_sell", departmentSlug: "paintings", assignedToUserId: "tom" },
      { intent: "private_sale_sell", departmentSlug: "prints" },
      { intent: "press" },
    ]);
    const refs = async (filters: Record<string, unknown>) =>
      (await desk.list(clientServices, query(filters))).items.map((i) => i.reference);
    expect(await refs({ department: "prints" })).toEqual(["E-1002"]);
    expect(await refs({ assignee: "tom" })).toEqual(["E-1001"]);
    expect(await refs({ assignee: "unassigned", kind: "press" })).toEqual(["E-1003"]);
  });

  it("pages with a cursor and stops when the list ends", async () => {
    const { desk } = await setup([{ intent: "press" }, { intent: "press" }, { intent: "press" }]);
    const first = await desk.list(clientServices, query({ limit: 2 }));
    expect(first.items.map((i) => i.reference)).toEqual(["E-1001", "E-1002"]);
    expect(first.nextCursor).not.toBeNull();
    const second = await desk.list(clientServices, query({ limit: 2, cursor: first.nextCursor }));
    expect(second.items.map((i) => i.reference)).toEqual(["E-1003"]);
    expect(second.nextCursor).toBeNull();
  });
});

describe("EnquiryDeskService detail", () => {
  it("opens by reference or id with a reply due two business days on, notes and next statuses", async () => {
    const { desk, enquiries } = await setup([{ intent: "press" }]);
    const byReference = await desk.detail(clientServices, "E-1001");
    const byId = await desk.detail(clientServices, enquiries.rows[0]?.id ?? "");
    expect(byId).toEqual(byReference);
    expect(byReference).toMatchObject({
      topicLabel: "Press",
      status: "new",
      version: 1,
      handledAt: null,
      // Received Monday 27 July 2026 12:00; due Wednesday 29 July.
      replyDueAt: "2026-07-29T12:00:00.000Z",
      nextStatuses: ["in_progress", "waiting_on_client", "closed"],
    });
    expect(await desk.detail(clientServices, "E-9999")).toBeNull();
  });
});

describe("EnquiryDeskService update", () => {
  it("assigns, moves the status and records a note in one change, with one event each", async () => {
    const { desk, publish } = await setup([{ intent: "private_sale_sell" }]);

    const result = await desk.update(clientServices, "cs-1", "E-1001", {
      version: 1,
      assignedToUserId: "spec-1",
      status: "in_progress",
      note: "Called the seller.",
    });

    expect(result).toMatchObject({
      ok: true,
      enquiry: {
        version: 2,
        status: "in_progress",
        assignedToUserId: "spec-1",
        notes: [{ body: "Called the seller.", authorUserId: "cs-1" }],
      },
    });
    expect(publish.mock.calls.map((call) => [call[0].eventType, call[0].actorUserId])).toEqual([
      ["marketing_enquiry.assigned", "cs-1"],
      ["marketing_enquiry.status_changed", "cs-1"],
    ]);
    expect(publish.mock.calls[1]?.[0].payload).toEqual({
      enquiryId: expect.any(String),
      intent: "private_sale_sell",
      from: "new",
      to: "in_progress",
    });
    expect(JSON.stringify(publish.mock.calls)).not.toContain("Called the seller");
  });

  it("closes with a reason and reopens, clearing the close", async () => {
    const { desk } = await setup([{ intent: "press" }]);
    const closed = await desk.update(clientServices, "cs-1", "E-1001", {
      version: 1,
      status: "closed",
      closeReason: "duplicate",
    });
    expect(closed).toMatchObject({
      ok: true,
      enquiry: { status: "closed", closeReason: "duplicate", handledAt: NOW.toISOString() },
    });
    const reopened = await desk.update(clientServices, "cs-1", "E-1001", {
      version: 2,
      status: "in_progress",
    });
    expect(reopened).toMatchObject({
      ok: true,
      enquiry: { status: "in_progress", closeReason: null, handledAt: null },
    });
  });

  it("refuses a stale write with the current version, and changes nothing", async () => {
    const { desk, publish, enquiries } = await setup([{ intent: "press" }]);
    await desk.update(clientServices, "cs-1", "E-1001", { version: 1, status: "in_progress" });
    publish.mockClear();

    const stale = await desk.update({ ...clientServices, userId: "cs-3" }, "cs-3", "E-1001", {
      version: 1,
      status: "waiting_on_client",
    });

    expect(stale).toEqual({ ok: false, error: "stale_version", currentVersion: 2 });
    expect(enquiries.rows[0]?.status).toBe("in_progress");
    expect(publish).not.toHaveBeenCalled();
  });

  it.each([
    ["closing without a reason", { status: "closed" }, "close_reason_required"],
    ["a reason without a close", { closeReason: "spam" }, "close_reason_without_status"],
    ["a status it already has", { status: "new" }, "unchanged"],
    ["converting by hand", { status: "converted" }, "not_allowed"],
    [
      "handing it to someone who is not staff",
      { assignedToUserId: "stranger" },
      "assignee_invalid",
    ],
  ])("refuses %s", async (_label, change, error) => {
    const { desk, publish } = await setup([{ intent: "private_sale_sell" }]);
    expect(
      await desk.update(clientServices, "cs-1", "E-1001", { version: 1, ...change } as never),
    ).toEqual({
      ok: false,
      error,
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("lets only people who may assign hand an enquiry over, but anyone who can see it add a note", async () => {
    const { desk } = await setup([{ intent: "private_sale_sell" }]);
    const cannotAssign = { ...specialist, canAssign: false };
    expect(
      await desk.update(cannotAssign, "spec-1", "E-1001", { version: 1, assignedToUserId: "tom" }),
    ).toEqual({ ok: false, error: "assign_forbidden" });
    expect(
      await desk.update(cannotAssign, "spec-1", "E-1001", { version: 1, note: "Seen." }),
    ).toMatchObject({ ok: true });
  });

  it("can take an enquiry back to unassigned", async () => {
    const { desk } = await setup([{ intent: "press", assignedToUserId: "tom" }]);
    const result = await desk.update(clientServices, "cs-1", "E-1001", {
      version: 1,
      assignedToUserId: null,
    });
    expect(result).toMatchObject({ ok: true, enquiry: { assignedToUserId: null } });
  });
});

describe("EnquiryDeskService markHandled", () => {
  it("closes an open enquiry and records who did it in an audited event", async () => {
    const { desk, publish, enquiries } = await setup([{ intent: "press" }]);
    const id = enquiries.rows[0]?.id ?? "";

    const result = await desk.markHandled(clientServices, id, "cs-1");

    expect(result).toMatchObject({ ok: true, enquiry: { status: "closed" } });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketing_enquiry.handled",
        actorUserId: "cs-1",
        payload: { enquiryId: id, intent: "press" },
      }),
    );
  });

  it("refuses to handle one twice, without an event", async () => {
    const { desk, publish, enquiries } = await setup([{ intent: "press" }]);
    const id = enquiries.rows[0]?.id ?? "";
    await desk.markHandled(clientServices, id, "cs-1");
    publish.mockClear();
    expect(await desk.markHandled(clientServices, id, "cs-2")).toEqual({
      ok: false,
      error: "already_handled",
    });
    expect(publish).not.toHaveBeenCalled();
  });
});
