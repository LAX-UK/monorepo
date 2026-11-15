import type {
  IEnquiryQuarantineReviewRepository,
  ITransactionRunner,
  NewInboundMessage,
  QuarantinedMessageRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { InMemoryMarketingEnquiries } from "../../testing/in-memory-marketing-enquiries.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { EnquiryStaffViewer } from "../interfaces/marketing-enquiry-service.js";
import {
  EnquiryQuarantineService,
  decodeQuarantineCursor,
  encodeQuarantineCursor,
} from "./enquiry-quarantine.service.js";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const HELD_ID = "0b4f8c1e-6a0a-4a53-9a2a-1c9f8f0e9a11";

const worker: EnquiryStaffViewer = {
  userId: "cs-1",
  readsGeneral: true,
  readsPrivateSale: true,
  canAssign: true,
};
const reader: EnquiryStaffViewer = { ...worker, userId: "viewer-1", canAssign: false };
const generalOnly: EnquiryStaffViewer = { ...worker, userId: "cs-2", readsPrivateSale: false };

async function setup(options: { status?: QuarantinedMessageRecord["status"] } = {}) {
  const enquiries = new InMemoryMarketingEnquiries(() => NOW);
  const general = await enquiries.createInTransaction(
    {},
    {
      intent: "general",
      topic: "buying",
      name: "Sam Sender",
      email: "sam@example.test",
      message: "Hello there",
      marketingOptIn: false,
    },
  );
  const privateSale = await enquiries.createInTransaction(
    {},
    {
      intent: "private_sale_sell",
      topic: "selling",
      name: "Pat Seller",
      email: "pat@example.test",
      message: "A work to sell",
      marketingOptIn: false,
    },
  );
  const held: QuarantinedMessageRecord = {
    id: HELD_ID,
    reason: "sender_mismatch",
    status: options.status ?? "pending",
    fromAddress: "colleague@example.test",
    subject: "Re: Your enquiry",
    attachmentCount: 1,
    suspectedEnquiry: { id: general.id, reference: general.reference, intent: "general" },
    receivedAt: new Date("2026-11-14T10:00:00.000Z"),
    purgeAt: new Date("2026-12-14T10:00:00.000Z"),
    reviewedAt: null,
    providerMessageId: "pm-held",
    body: "Forwarding on behalf of Sam.",
    attachments: [{ name: "scan.pdf", contentType: "application/pdf", sizeBytes: 4096 }],
    spfResult: "pass",
    dkimResult: "none",
    reviewedByUserId: null,
  };
  const markReviewedInTransaction = vi.fn(
    async (_tx: unknown, _id: string, review: { status: "linked" | "dismissed" }) => {
      held.status = review.status;
    },
  );
  const quarantine: IEnquiryQuarantineReviewRepository = {
    list: vi.fn(async () => [held]),
    countPending: vi.fn(async () => 1),
    findById: vi.fn(async (id, scope) => (id === held.id && scope.readsGeneral ? held : null)),
    lockInTransaction: vi.fn(async (_tx, id) => (id === held.id ? { ...held } : null)),
    markReviewedInTransaction,
  };
  const inserted: NewInboundMessage[] = [];
  const inbound = {
    insertInboundMessageInTransaction: vi.fn(async (_tx: unknown, input: NewInboundMessage) => {
      inserted.push(input);
      return { id: "msg-1" };
    }),
    markAwaitingReplyInTransaction: vi.fn(async () => {}),
  };
  const published: Array<{ eventType: string; payload: unknown; actorUserId?: string }> = [];
  const events: IDomainEventSink = {
    publish: vi.fn(async (event) => {
      published.push(event);
    }),
    withTx: () => events,
  };
  const transactionRunner = {
    runInTransaction: (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as ITransactionRunner;
  const service = new EnquiryQuarantineService({
    quarantine,
    inbound,
    enquiries,
    transactionRunner,
    events,
    now: () => NOW,
  });
  return { service, held, general, privateSale, inserted, inbound, published, quarantine };
}

describe("EnquiryQuarantineService list and read", () => {
  it("lists held mail with the suspected enquiry by reference, and a cursor that round-trips", async () => {
    const t = await setup();
    const page = await t.service.list(worker, { view: "pending", limit: 25 });
    expect(page.pendingCount).toBe(1);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toEqual({
      id: HELD_ID,
      reason: "sender_mismatch",
      status: "pending",
      fromAddress: "colleague@example.test",
      subject: "Re: Your enquiry",
      attachmentCount: 1,
      suspectedEnquiry: { reference: t.general.reference, intent: "general" },
      receivedAt: "2026-11-14T10:00:00.000Z",
      purgeAt: "2026-12-14T10:00:00.000Z",
      reviewedAt: null,
    });
    const cursor = encodeQuarantineCursor({ receivedAt: t.held.receivedAt, id: HELD_ID });
    expect(decodeQuarantineCursor(cursor)).toEqual({ receivedAt: t.held.receivedAt, id: HELD_ID });
    expect(decodeQuarantineCursor("not-ours")).toBeNull();
  });

  it("reads one held mail as plain text with the metadata of its files", async () => {
    const t = await setup();
    const view = await t.service.detail(reader, HELD_ID);
    expect(view).toMatchObject({
      body: "Forwarding on behalf of Sam.",
      attachments: [{ name: "scan.pdf", contentType: "application/pdf", sizeBytes: 4096 }],
      spfResult: "pass",
      dkimResult: "none",
    });
  });
});

describe("EnquiryQuarantineService attach", () => {
  it("files the held mail on the suspected enquiry once, marks it awaiting a reply and audits who did it", async () => {
    const t = await setup();
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
    });
    expect(result).toEqual({ ok: true, enquiryReference: t.general.reference, messageId: "msg-1" });
    expect(t.inserted[0]).toMatchObject({
      enquiryId: t.general.id,
      providerMessageId: "pm-held",
      matchedBy: "staff",
      body: "Forwarding on behalf of Sam.",
      spfResult: "pass",
      dkimResult: "none",
    });
    // The address is only ever stored as a hash on the thread.
    expect(JSON.stringify(t.inserted[0])).not.toContain("colleague@example.test");
    expect(t.inbound.markAwaitingReplyInTransaction).toHaveBeenCalledWith({}, t.general.id, NOW);
    expect(t.quarantine.markReviewedInTransaction).toHaveBeenCalledWith({}, HELD_ID, {
      status: "linked",
      byUserId: "cs-1",
      at: NOW,
    });
    expect(t.published).toEqual([
      expect.objectContaining({
        eventType: "marketing_enquiry.inbound_attached",
        actorUserId: "cs-1",
        payload: {
          enquiryId: t.general.id,
          intent: "general",
          quarantineId: HELD_ID,
          messageId: "msg-1",
          reason: "sender_mismatch",
          suspectedEnquiry: true,
          attachmentCount: 1,
        },
      }),
    ]);
  });

  it("files it on another enquiry a person picks, and says it was not the suspected one", async () => {
    const t = await setup();
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.privateSale.reference,
    });
    expect(result).toMatchObject({ ok: true, enquiryReference: t.privateSale.reference });
    expect(t.published[0]?.payload).toMatchObject({ suspectedEnquiry: false });
  });

  it("refuses an enquiry the person may not open as if it did not exist", async () => {
    const t = await setup();
    const result = await t.service.attach(generalOnly, HELD_ID, {
      enquiryReference: t.privateSale.reference,
    });
    expect(result).toEqual({ ok: false, error: "enquiry_not_found" });
    expect(t.inserted).toHaveLength(0);
  });

  it("refuses an unknown enquiry reference", async () => {
    const t = await setup();
    expect(await t.service.attach(worker, HELD_ID, { enquiryReference: "E-9999" })).toEqual({
      ok: false,
      error: "enquiry_not_found",
    });
  });

  it("refuses people who may only read enquiries, before touching anything", async () => {
    const t = await setup();
    const result = await t.service.attach(reader, HELD_ID, {
      enquiryReference: t.general.reference,
    });
    expect(result).toEqual({ ok: false, error: "review_forbidden" });
    expect(t.quarantine.lockInTransaction).not.toHaveBeenCalled();
    expect(t.published).toHaveLength(0);
  });

  it("attaches once: a second attach, or one on reviewed mail, is refused without an event", async () => {
    const t = await setup();
    await t.service.attach(worker, HELD_ID, { enquiryReference: t.general.reference });
    const again = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
    });
    expect(again).toEqual({ ok: false, error: "already_reviewed" });
    expect(t.inserted).toHaveLength(1);
    expect(t.published).toHaveLength(1);
  });

  it("answers not found for held mail the person may not see", async () => {
    const t = await setup();
    const blind = { ...worker, readsGeneral: false };
    expect(
      await t.service.attach(blind, HELD_ID, { enquiryReference: t.general.reference }),
    ).toEqual({ ok: false, error: "quarantine_not_found" });
  });
});

describe("EnquiryQuarantineService discard", () => {
  it("discards once and audits who did it with ids and the reason only", async () => {
    const t = await setup();
    expect(await t.service.discard(worker, HELD_ID)).toEqual({ ok: true });
    expect(t.published).toEqual([
      expect.objectContaining({
        eventType: "marketing_enquiry.inbound_discarded",
        actorUserId: "cs-1",
        payload: { quarantineId: HELD_ID, reason: "sender_mismatch" },
      }),
    ]);
    expect(await t.service.discard(worker, HELD_ID)).toEqual({
      ok: false,
      error: "already_reviewed",
    });
    expect(t.published).toHaveLength(1);
  });

  it("refuses people who may only read enquiries", async () => {
    const t = await setup();
    expect(await t.service.discard(reader, HELD_ID)).toEqual({
      ok: false,
      error: "review_forbidden",
    });
  });

  it("refuses mail that was already attached", async () => {
    const t = await setup({ status: "linked" });
    expect(await t.service.discard(worker, HELD_ID)).toEqual({
      ok: false,
      error: "already_reviewed",
    });
  });
});
