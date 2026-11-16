import { emailHash } from "@auction/email";
import type { ITransactionRunner, InboundThreadMessage } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryEnquiryNotes,
  InMemoryMarketingEnquiries,
} from "../../testing/in-memory-marketing-enquiries.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { EnquiryStaffViewer } from "../interfaces/marketing-enquiry-service.js";
import { ENQUIRY_ATTACHMENT_LINK_TTL_SEC, EnquiryDeskService } from "./enquiry-desk.service.js";

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
  name?: string;
  artist?: string;
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
  const listRedacted = vi.fn().mockResolvedValue([]);
  const actorNames = vi.fn().mockResolvedValue(new Map<string, string>());
  const createPresignedGet = vi.fn().mockResolvedValue({ url: "https://signed.example/f?sig=1" });
  const replies = new Map<string, InboundThreadMessage[]>();
  const listInbound = vi.fn(async (enquiryId: string) => replies.get(enquiryId) ?? []);
  const desk = new EnquiryDeskService({
    enquiries,
    notes,
    replies: { listInbound },
    assignees: { isStaff: async (id) => staff.has(id), list: async () => [] },
    transactionRunner,
    events,
    history: { listRedacted, actorNames },
    storage: { createPresignedGet },
    now: () => NOW,
  });
  for (const seed of seeds) {
    await enquiries.createInTransaction(
      {},
      {
        intent: seed.intent,
        topic: seed.intent === "private_sale_sell" ? "selling" : "press",
        name: seed.name ?? "Ada Lovelace",
        email: "ada@example.com",
        message: "A message that is long enough.",
        marketingOptIn: false,
        ...(seed.artist
          ? {
              privateSale: {
                artist: seed.artist,
                title: null,
                medium: null,
                size: null,
                locationTown: null,
                locationCountry: null,
                priceInMindMinor: null,
                lookingFor: null,
                budgetBand: null,
                timing: null,
                contactPreference: "email" as const,
              },
            }
          : {}),
        ...(seed.assignedToUserId ? { assignedToUserId: seed.assignedToUserId } : {}),
        ...(seed.departmentSlug ? { departmentSlug: seed.departmentSlug } : {}),
      },
    );
  }
  return {
    desk,
    enquiries,
    notes,
    publish,
    listRedacted,
    actorNames,
    createPresignedGet,
    replies,
    listInbound,
  };
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

describe("EnquiryDeskService email replies", () => {
  const reply: InboundThreadMessage = {
    id: "m-1",
    receivedAt: new Date("2026-07-28T09:30:00.000Z"),
    subject: "Re: Your enquiry E-1001",
    body: "Thanks, Tuesday works.",
    attachments: [{ name: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 }],
    matchedBy: "token",
    spfResult: "pass",
    dkimResult: "none",
    heldReason: null,
    reviewReason: null,
    fromEmailHash: "hash-of-the-client",
  };

  it("shows the client's emailed replies on the record and the awaiting-reply mark on the list", async () => {
    const { desk, enquiries, replies, listInbound } = await setup([{ intent: "press" }]);
    const row = enquiries.rows[0];
    if (!row) throw new Error("seed");
    row.awaitingReplySince = reply.receivedAt;
    replies.set(row.id, [reply]);

    const view = await desk.detail(clientServices, "E-1001");
    expect(view?.replies).toEqual([
      {
        id: "m-1",
        receivedAt: "2026-07-28T09:30:00.000Z",
        subject: "Re: Your enquiry E-1001",
        body: "Thanks, Tuesday works.",
        attachments: [{ name: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 }],
        matchedBy: "token",
        spfResult: "pass",
        dkimResult: "none",
        heldReason: null,
        reviewReason: null,
        senderVerified: true,
        fromOtherAddress: false,
      },
    ]);
    expect(view?.awaitingReplySince).toBe("2026-07-28T09:30:00.000Z");
    expect(listInbound).toHaveBeenCalledWith(row.id, 200);

    const page = await desk.list(clientServices, query());
    expect(page.items[0]?.awaitingReplySince).toBe("2026-07-28T09:30:00.000Z");
  });

  it("says when staff attached held mail whose sender is not verified, and why it was held", async () => {
    const { desk, enquiries, replies } = await setup([{ intent: "press" }]);
    const row = enquiries.rows[0];
    if (!row) throw new Error("seed");
    const attached = (id: string, values: Partial<InboundThreadMessage>): InboundThreadMessage => ({
      ...reply,
      id,
      matchedBy: "staff",
      reviewReason: "Client confirmed it by phone",
      ...values,
    });
    replies.set(row.id, [
      attached("m-other", { heldReason: "sender_mismatch", fromEmailHash: emailHash("x@y.test") }),
      attached("m-unauth", {
        heldReason: "unauthenticated",
        spfResult: "neutral",
        fromEmailHash: emailHash(row.email.toUpperCase()),
      }),
      attached("m-ok", { heldReason: "unmatched", fromEmailHash: emailHash(row.email) }),
    ]);
    const view = await desk.detail(clientServices, "E-1001");
    expect(
      view?.replies.map((r) => [r.id, r.heldReason, r.senderVerified, r.fromOtherAddress]),
    ).toEqual([
      ["m-other", "sender_mismatch", false, true],
      ["m-unauth", "unauthenticated", false, false],
      ["m-ok", "unmatched", true, false],
    ]);
    expect(view?.replies[0]?.reviewReason).toBe("Client confirmed it by phone");
    // The hash of the address never leaves the API.
    expect(JSON.stringify(view)).not.toContain("fromEmailHash");
  });

  it("never reads the replies of an enquiry the viewer may not open", async () => {
    const { desk, listInbound } = await setup([{ intent: "private_sale_sell" }]);
    expect(await desk.detail(noPrivateAccess, "E-1001")).toBeNull();
    expect(listInbound).not.toHaveBeenCalled();
  });

  it("stops waiting for a reply once staff move it to waiting on the client", async () => {
    const { desk, enquiries } = await setup([{ intent: "press" }]);
    const row = enquiries.rows[0];
    if (!row) throw new Error("seed");
    row.awaitingReplySince = reply.receivedAt;
    const moved = await desk.update(clientServices, "cs-1", "E-1001", {
      version: 1,
      status: "waiting_on_client",
    });
    expect(moved).toMatchObject({ ok: true, enquiry: { awaitingReplySince: null } });
  });

  it("keeps waiting for a reply when staff only start work on it", async () => {
    const { desk, enquiries } = await setup([{ intent: "press" }]);
    const row = enquiries.rows[0];
    if (!row) throw new Error("seed");
    row.awaitingReplySince = reply.receivedAt;
    const moved = await desk.update(clientServices, "cs-1", "E-1001", {
      version: 1,
      status: "in_progress",
    });
    expect(moved).toMatchObject({
      ok: true,
      enquiry: { awaitingReplySince: "2026-07-28T09:30:00.000Z" },
    });
  });

  it("stops waiting for a reply when the enquiry is closed", async () => {
    const { desk, enquiries } = await setup([{ intent: "press" }]);
    const row = enquiries.rows[0];
    if (!row) throw new Error("seed");
    row.awaitingReplySince = reply.receivedAt;
    const closed = await desk.markHandled(clientServices, row.id, "cs-1");
    expect(closed).toMatchObject({ ok: true, enquiry: { awaitingReplySince: null } });
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

describe("EnquiryDeskService list search, sort and counts", () => {
  const seeds: Seed[] = [
    { intent: "press", name: "Grace Hopper" },
    { intent: "private_sale_sell", name: "Ada Lovelace", artist: "Bridget Riley" },
    { intent: "press", name: "Alan Turing" },
  ];

  it("finds by name, reference, email and the artist of the work, ignoring case", async () => {
    const { desk } = await setup(seeds);
    const refs = async (q: string) =>
      (await desk.list(clientServices, query({ view: "all", q }))).items.map((i) => i.reference);
    expect(await refs("hopper")).toEqual(["E-1001"]);
    expect(await refs("e-1003")).toEqual(["E-1003"]);
    expect(await refs("riley")).toEqual(["E-1002"]);
    expect(await refs("ada@")).toHaveLength(3);
    expect(await refs("nobody")).toEqual([]);
  });

  it("does not let a search reach enquiries the viewer may not see", async () => {
    const { desk } = await setup(seeds);
    const page = await desk.list(noPrivateAccess, query({ view: "all", q: "riley" }));
    expect(page.items).toEqual([]);
    expect(page.counts.new).toBe(0);
  });

  it("sorts by arrival, newest or oldest, over the view's own order", async () => {
    const { desk } = await setup(seeds);
    const order = async (sort: "oldest" | "newest") =>
      (await desk.list(clientServices, query({ view: "all", sort }))).items.map((i) => i.reference);
    expect(await order("oldest")).toEqual([...(await order("newest"))].reverse());
  });

  it("counts every status under the view and filters, except the status filter", async () => {
    const { desk } = await setup(seeds);
    await desk.update(clientServices, "cs-1", "E-1001", { version: 1, status: "in_progress" });
    const all = await desk.list(clientServices, query({ view: "all" }));
    expect(all.counts).toEqual({
      new: 2,
      in_progress: 1,
      waiting_on_client: 0,
      converted: 0,
      closed: 0,
    });
    const filtered = await desk.list(clientServices, query({ view: "all", status: "new" }));
    expect(filtered.items).toHaveLength(2);
    expect(filtered.counts.in_progress).toBe(1);
    const searched = await desk.list(clientServices, query({ view: "all", q: "hopper" }));
    expect(searched.counts).toMatchObject({ in_progress: 1, new: 0 });
  });
});

describe("EnquiryDeskService attachment links", () => {
  const attachment = {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    uploadObjectId: "u-1",
    kind: "image" as const,
    position: 0,
    key: "enquiries/private/photo.jpg",
    contentType: "image/jpeg",
  };

  async function withAttachment() {
    const ctx = await setup([{ intent: "private_sale_sell" }, { intent: "press" }]);
    ctx.enquiries.attachments.set(ctx.enquiries.rows[0]?.id as string, [attachment]);
    return ctx;
  }

  it("signs a short-lived link, never a public object URL, and records who opened it", async () => {
    const { desk, createPresignedGet, publish } = await withAttachment();
    const link = await desk.attachmentLink(specialist, "E-1001", attachment.id);
    expect(link).toEqual({
      url: "https://signed.example/f?sig=1",
      kind: "image",
      contentType: "image/jpeg",
      expiresInSec: ENQUIRY_ATTACHMENT_LINK_TTL_SEC,
    });
    expect(ENQUIRY_ATTACHMENT_LINK_TTL_SEC).toBeLessThanOrEqual(120);
    expect(createPresignedGet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: attachment.key,
        expiresInSec: ENQUIRY_ATTACHMENT_LINK_TTL_SEC,
        signingDate: NOW,
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "marketing_enquiry.attachment_viewed",
        actorUserId: "spec-1",
        payload: expect.objectContaining({ attachmentId: attachment.id, kind: "image" }),
      }),
    );
    expect(JSON.stringify(publish.mock.calls)).not.toContain(attachment.key);
  });

  it("answers as if there were no file to someone who may not open the enquiry", async () => {
    const { desk, createPresignedGet, publish } = await withAttachment();
    expect(await desk.attachmentLink(noPrivateAccess, "E-1001", attachment.id)).toBeNull();
    expect(createPresignedGet).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("will not serve a file through another enquiry's reference", async () => {
    const { desk, createPresignedGet } = await withAttachment();
    expect(await desk.attachmentLink(clientServices, "E-1002", attachment.id)).toBeNull();
    expect(await desk.attachmentLink(clientServices, "E-1001", "missing")).toBeNull();
    expect(createPresignedGet).not.toHaveBeenCalled();
  });
});

describe("EnquiryDeskService history", () => {
  it("reads assignments and status changes from the audit trail, oldest first, and hides the enquiry from those who cannot open it", async () => {
    const { desk, enquiries, listRedacted } = await setup([{ intent: "private_sale_sell" }]);
    const id = enquiries.rows[0]?.id as string;
    const at = (n: number) => new Date(`2026-07-2${n}T09:00:00.000Z`);
    // The reader answers newest first; the history is oldest first.
    listRedacted.mockResolvedValue([
      {
        id: 2,
        eventType: "marketing_enquiry.status_changed",
        actorUserId: "tom",
        occurredAt: at(2),
        payload: { from: "new", to: "closed", closeReason: "spam" },
      },
      {
        id: 1,
        eventType: "marketing_enquiry.assigned",
        actorUserId: "cs-1",
        occurredAt: at(1),
        payload: { assignedToUserId: "tom", previousAssignedToUserId: null },
      },
    ]);
    const entries = await desk.history(clientServices, "E-1001");
    expect(listRedacted).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "marketing_enquiry",
        aggregateId: id,
        includePii: false,
        newestFirst: true,
        eventTypes: [
          "marketing_enquiry.assigned",
          "marketing_enquiry.status_changed",
          "marketing_enquiry.converted",
        ],
      }),
    );
    expect(entries).toEqual([
      {
        id: "1",
        at: at(1).toISOString(),
        actorUserId: "cs-1",
        actorName: null,
        kind: "assigned",
        toUserId: "tom",
        fromUserId: null,
        toName: null,
        fromName: null,
      },
      {
        id: "2",
        at: at(2).toISOString(),
        actorUserId: "tom",
        actorName: null,
        kind: "status_changed",
        from: "new",
        to: "closed",
        closeReason: "spam",
      },
    ]);
    expect(await desk.history(noPrivateAccess, "E-1001")).toBeNull();
  });
  it("names the people involved from the identity directory, and leaves unknown ones null", async () => {
    const { desk, listRedacted, actorNames } = await setup([{ intent: "private_sale_sell" }]);
    listRedacted.mockResolvedValue([
      {
        id: 1,
        eventType: "marketing_enquiry.assigned",
        actorUserId: "cs-1",
        occurredAt: new Date("2026-07-21T09:00:00.000Z"),
        payload: { assignedToUserId: "tom", previousAssignedToUserId: "gone" },
      },
    ]);
    actorNames.mockResolvedValue(
      new Map([
        ["cs-1", "Chloe Stone"],
        ["tom", "Tom Reid"],
      ]),
    );
    const entries = await desk.history(clientServices, "E-1001");
    expect(actorNames).toHaveBeenCalledWith(expect.arrayContaining(["cs-1", "tom", "gone"]));
    expect(entries).toEqual([
      expect.objectContaining({
        actorName: "Chloe Stone",
        toName: "Tom Reid",
        fromName: null,
        fromUserId: "gone",
      }),
    ]);
  });
});
