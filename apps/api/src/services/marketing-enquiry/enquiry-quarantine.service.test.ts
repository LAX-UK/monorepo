import { ERASED_ENQUIRY } from "@auction/domain";
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
/** A reason, and the explicit confirmation a sender that is not verified needs. */
const CONFIRMED = {
  reason: "Sam confirmed by phone that their colleague sent it",
  confirmSenderNotVerified: true,
};
const DISCARD = { reason: "Marketing email, not about the enquiry" };

const worker: EnquiryStaffViewer = {
  userId: "cs-1",
  readsGeneral: true,
  readsPrivateSale: true,
  canAssign: true,
};
const reader: EnquiryStaffViewer = { ...worker, userId: "viewer-1", canAssign: false };
const generalOnly: EnquiryStaffViewer = { ...worker, userId: "cs-2", readsPrivateSale: false };

async function setup(
  options: {
    status?: QuarantinedMessageRecord["status"];
    held?: Partial<QuarantinedMessageRecord>;
  } = {},
) {
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
    ...options.held,
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
    // Reads the enquiry as it stands now, the way the row lock does inside the transaction.
    lockTargetInTransaction: vi.fn(async (_tx: unknown, id: string) => {
      const row = enquiries.rows.find((r) => r.id === id);
      return row ? { ...row } : null;
    }),
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
  return {
    service,
    held,
    general,
    privateSale,
    inserted,
    inbound,
    published,
    quarantine,
    enquiries,
  };
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
      ...CONFIRMED,
    });
    expect(result).toEqual({ ok: true, enquiryReference: t.general.reference, messageId: "msg-1" });
    expect(t.inserted[0]).toMatchObject({
      enquiryId: t.general.id,
      providerMessageId: "pm-held",
      matchedBy: "staff",
      body: "Forwarding on behalf of Sam.",
      spfResult: "pass",
      dkimResult: "none",
      heldReason: "sender_mismatch",
      reviewReason: CONFIRMED.reason,
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
          spfResult: "pass",
          dkimResult: "none",
          senderVerified: false,
          reviewReason: CONFIRMED.reason,
        },
      }),
    ]);
  });

  it("files it on another enquiry a person picks, and says it was not the suspected one", async () => {
    const t = await setup();
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.privateSale.reference,
      ...CONFIRMED,
    });
    expect(result).toMatchObject({ ok: true, enquiryReference: t.privateSale.reference });
    expect(t.published[0]?.payload).toMatchObject({ suspectedEnquiry: false });
  });

  it("refuses an enquiry the person may not open as if it did not exist", async () => {
    const t = await setup();
    const result = await t.service.attach(generalOnly, HELD_ID, {
      enquiryReference: t.privateSale.reference,
      ...CONFIRMED,
    });
    expect(result).toEqual({ ok: false, error: "enquiry_not_found" });
    expect(t.inserted).toHaveLength(0);
  });

  it("refuses an unknown enquiry reference", async () => {
    const t = await setup();
    expect(
      await t.service.attach(worker, HELD_ID, { enquiryReference: "E-9999", ...CONFIRMED }),
    ).toEqual({
      ok: false,
      error: "enquiry_not_found",
    });
  });

  it("refuses people who may only read enquiries, before touching anything", async () => {
    const t = await setup();
    const result = await t.service.attach(reader, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    expect(result).toEqual({ ok: false, error: "review_forbidden" });
    expect(t.quarantine.lockInTransaction).not.toHaveBeenCalled();
    expect(t.published).toHaveLength(0);
  });

  it("attaches once: a second attach, or one on reviewed mail, is refused without an event", async () => {
    const t = await setup();
    await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    const again = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    expect(again).toEqual({ ok: false, error: "already_reviewed" });
    expect(t.inserted).toHaveLength(1);
    expect(t.published).toHaveLength(1);
  });

  it("answers not found for held mail the person may not see", async () => {
    const t = await setup();
    const blind = { ...worker, readsGeneral: false };
    expect(
      await t.service.attach(blind, HELD_ID, {
        enquiryReference: t.general.reference,
        ...CONFIRMED,
      }),
    ).toEqual({ ok: false, error: "quarantine_not_found" });
  });
});

describe("EnquiryQuarantineService attach: unverified senders and erased enquiries", () => {
  it("refuses to attach mail from a sender that is not verified unless the person confirms it", async () => {
    const t = await setup();
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      reason: CONFIRMED.reason,
      confirmSenderNotVerified: false,
    });
    expect(result).toEqual({ ok: false, error: "sender_confirmation_required" });
    expect(t.inserted).toHaveLength(0);
    expect(t.quarantine.markReviewedInTransaction).not.toHaveBeenCalled();
    expect(t.published).toHaveLength(0);
  });

  it.each([
    ["failed SPF", { reason: "spf_failed", spfResult: "fail" }],
    ["no verified sender", { reason: "unauthenticated", spfResult: "neutral" }],
    ["an SPF pass for another domain", { reason: "unmatched", spfResult: "pass_unaligned" }],
    ["no recorded result", { reason: "unmatched", spfResult: null, dkimResult: null }],
  ] as const)("needs the confirmation for %s, even from the client's address", async (_l, held) => {
    const t = await setup({ held: { ...held, fromAddress: "sam@example.test" } });
    const refused = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      reason: CONFIRMED.reason,
      confirmSenderNotVerified: false,
    });
    expect(refused).toEqual({ ok: false, error: "sender_confirmation_required" });
    const confirmed = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    expect(confirmed).toMatchObject({ ok: true });
    expect(t.published[0]?.payload).toMatchObject({ senderVerified: false });
  });

  it("attaches unmatched mail from the client's own verified address without the confirmation", async () => {
    const t = await setup({
      held: { reason: "unmatched", fromAddress: "Sam@Example.test", suspectedEnquiry: null },
    });
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      reason: "Client quoted the reference in the subject",
      confirmSenderNotVerified: false,
    });
    expect(result).toMatchObject({ ok: true });
    expect(t.published[0]?.payload).toMatchObject({ senderVerified: true, reason: "unmatched" });
  });

  it("needs the confirmation for verified mail from an address other than the enquiry's client", async () => {
    const t = await setup({ held: { reason: "unmatched", suspectedEnquiry: null } });
    expect(
      await t.service.attach(worker, HELD_ID, {
        enquiryReference: t.general.reference,
        reason: CONFIRMED.reason,
        confirmSenderNotVerified: false,
      }),
    ).toEqual({ ok: false, error: "sender_confirmation_required" });
  });

  it("never files held mail on an enquiry that was erased", async () => {
    const t = await setup();
    const erased = await t.enquiries.createInTransaction(
      {},
      {
        intent: "general",
        topic: "buying",
        name: ERASED_ENQUIRY.name,
        email: ERASED_ENQUIRY.email,
        message: ERASED_ENQUIRY.message,
        marketingOptIn: false,
      },
    );
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: erased.reference,
      ...CONFIRMED,
    });
    expect(result).toEqual({ ok: false, error: "enquiry_erased" });
    expect(t.quarantine.lockInTransaction).not.toHaveBeenCalled();
    expect(t.inserted).toHaveLength(0);
    expect(t.published).toHaveLength(0);
  });
  it("re-reads the enquiry under a lock and refuses when it was erased after the first check", async () => {
    const t = await setup();
    const findByRef = t.enquiries.findByRef.bind(t.enquiries);
    // The erasure commits after the check made before the transaction, and before the lock.
    vi.spyOn(t.enquiries, "findByRef").mockImplementation(async (ref) => {
      const found = await findByRef(ref);
      const row = t.enquiries.rows.find((r) => r.id === found?.id);
      if (row) Object.assign(row, { name: ERASED_ENQUIRY.name, email: ERASED_ENQUIRY.email });
      return found;
    });
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    expect(result).toEqual({ ok: false, error: "enquiry_erased" });
    expect(t.inbound.lockTargetInTransaction).toHaveBeenCalledWith({}, t.general.id);
    // The enquiry is locked before the held mail, the order erasure takes them in.
    expect(t.quarantine.lockInTransaction).not.toHaveBeenCalled();
    expect(t.inserted).toHaveLength(0);
    expect(t.inbound.markAwaitingReplyInTransaction).not.toHaveBeenCalled();
    expect(t.quarantine.markReviewedInTransaction).not.toHaveBeenCalled();
    expect(t.published).toHaveLength(0);
    expect(t.held.status).toBe("pending");
  });

  it("refuses when the enquiry is gone by the time it is locked", async () => {
    const t = await setup();
    t.inbound.lockTargetInTransaction.mockResolvedValueOnce(null);
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    expect(result).toEqual({ ok: false, error: "enquiry_not_found" });
    expect(t.inserted).toHaveLength(0);
  });

  it("locks the enquiry before the held mail on an attach that goes ahead", async () => {
    const t = await setup();
    const result = await t.service.attach(worker, HELD_ID, {
      enquiryReference: t.general.reference,
      ...CONFIRMED,
    });
    expect(result.ok).toBe(true);
    const enquiryLock = t.inbound.lockTargetInTransaction.mock.invocationCallOrder[0] ?? 0;
    const heldLock = vi.mocked(t.quarantine.lockInTransaction).mock.invocationCallOrder[0] ?? 0;
    expect(enquiryLock).toBeGreaterThan(0);
    expect(enquiryLock).toBeLessThan(heldLock);
  });
});

describe("EnquiryQuarantineService discard", () => {
  it("discards once and audits who did it, why it was held and the reason given", async () => {
    const t = await setup();
    expect(await t.service.discard(worker, HELD_ID, DISCARD)).toEqual({ ok: true });
    expect(t.published).toEqual([
      expect.objectContaining({
        eventType: "marketing_enquiry.inbound_discarded",
        actorUserId: "cs-1",
        payload: {
          quarantineId: HELD_ID,
          reason: "sender_mismatch",
          reviewReason: DISCARD.reason,
        },
      }),
    ]);
    expect(await t.service.discard(worker, HELD_ID, DISCARD)).toEqual({
      ok: false,
      error: "already_reviewed",
    });
    expect(t.published).toHaveLength(1);
  });

  it("refuses people who may only read enquiries", async () => {
    const t = await setup();
    expect(await t.service.discard(reader, HELD_ID, DISCARD)).toEqual({
      ok: false,
      error: "review_forbidden",
    });
  });

  it("refuses mail that was already attached", async () => {
    const t = await setup({ status: "linked" });
    expect(await t.service.discard(worker, HELD_ID, DISCARD)).toEqual({
      ok: false,
      error: "already_reviewed",
    });
  });
});
