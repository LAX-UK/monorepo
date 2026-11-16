import type {
  IEnquiryInboundRepository,
  InboundEnquiryTarget,
  NewInboundMessage,
  NewQuarantinedMessage,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  EnquiryInboundReplyService,
  type InboundPayload,
  inboundPayloadSchema,
} from "./enquiry-inbound-reply.service.js";
import { EnquiryReplyAddresses } from "./enquiry-reply-address.js";

const ID = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";
const addresses = new EnquiryReplyAddresses({
  baseAddress: "replies@inbound.example.test",
  secret: "k".repeat(40),
});
const TARGET: InboundEnquiryTarget = {
  id: ID,
  reference: "E-1042",
  intent: "general",
  topic: "buying",
  name: "Sam Sender",
  email: "Sam@Example.test",
  status: "waiting_on_client",
};

function setup(
  options: {
    target?: InboundEnquiryTarget | null;
    outboundTarget?: InboundEnquiryTarget | null;
  } = {},
) {
  const inbound = new Map<string, NewInboundMessage>();
  const held = new Map<string, NewQuarantinedMessage>();
  const published: { eventType: string; payload: Record<string, unknown> }[] = [];
  const awaiting = vi.fn();
  const notifyReply = vi.fn().mockResolvedValue(undefined);
  const repository: IEnquiryInboundRepository = {
    findTargetById: vi.fn(async (id: string) =>
      options.target === undefined ? (id === ID ? TARGET : null) : options.target,
    ),
    findTargetByOutboundMessageIds: vi.fn(async () => options.outboundTarget ?? null),
    insertInboundMessageInTransaction: vi.fn(async (_tx, input: NewInboundMessage) => {
      if (inbound.has(input.providerMessageId)) return null;
      inbound.set(input.providerMessageId, input);
      return { id: `msg-${inbound.size}` };
    }),
    markAwaitingReplyInTransaction: awaiting,
    insertQuarantineInTransaction: vi.fn(async (_tx, input: NewQuarantinedMessage) => {
      if (held.has(input.providerMessageId)) return null;
      held.set(input.providerMessageId, input);
      return { id: `q-${held.size}` };
    }),
    isKnownProviderMessage: vi.fn(async (id: string) => inbound.has(id) || held.has(id)),
  };
  const events = {
    publish: vi.fn(),
    withTx: () => ({
      publish: async (e: { eventType: string; payload: Record<string, unknown> }) => {
        published.push(e);
      },
      withTx: () => events,
    }),
  };
  const service = new EnquiryInboundReplyService({
    repository,
    addresses,
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
    events: events as never,
    alert: { notifyReply },
    now: () => new Date("2026-11-15T10:00:00Z"),
  });
  return { service, inbound, held, published, awaiting, notifyReply, repository };
}

function mail(overrides: Record<string, unknown> = {}): InboundPayload {
  return inboundPayloadSchema.parse({
    MessageID: "pm-1",
    From: "Sam Sender <sam@example.test>",
    FromFull: { Email: "sam@example.test" },
    ToFull: [{ Email: addresses.addressFor(ID) }],
    OriginalRecipient: addresses.addressFor(ID),
    Subject: "Re: Your enquiry E-1042",
    TextBody: "Thanks!\n\nOn Monday you wrote:\n> quoted",
    StrippedTextReply: "Thanks!",
    Headers: [{ Name: "Received-SPF", Value: "Pass (sender SPF authorized)" }],
    Attachments: [
      { Name: "photo.jpg", ContentType: "image/jpeg", ContentLength: 1234, Content: "QUJD" },
    ],
    ...overrides,
  });
}

describe("EnquiryInboundReplyService", () => {
  it("files a reply on the thread named by its reply address and flags the thread", async () => {
    const t = setup();
    const result = await t.service.handle(mail());
    expect(result).toEqual({ outcome: "stored", messageId: "msg-1", enquiryId: ID });
    const stored = t.inbound.get("pm-1");
    expect(stored).toMatchObject({
      enquiryId: ID,
      matchedBy: "token",
      subject: "Re: Your enquiry E-1042",
      body: "Thanks!",
      attachments: [{ name: "photo.jpg", contentType: "image/jpeg", sizeBytes: 1234 }],
    });
    // The file itself never reaches storage.
    expect(JSON.stringify(stored)).not.toContain("QUJD");
    expect(t.awaiting).toHaveBeenCalledWith(
      expect.anything(),
      ID,
      new Date("2026-11-15T10:00:00Z"),
    );
    expect(t.published[0]).toMatchObject({
      eventType: "marketing_enquiry.customer_replied",
      payload: { enquiryId: ID, matchedBy: "token", attachmentCount: 1 },
    });
    expect(JSON.stringify(t.published)).not.toContain("sam@example.test");
    expect(t.notifyReply).toHaveBeenCalledWith(TARGET, { messageId: "msg-1", text: "Thanks!" });
  });

  it("is idempotent on MessageID: a replay stores and notifies once", async () => {
    const t = setup();
    await t.service.handle(mail());
    const again = await t.service.handle(mail());
    expect(again).toEqual({ outcome: "duplicate" });
    expect(t.inbound.size).toBe(1);
    expect(t.notifyReply).toHaveBeenCalledTimes(1);
    expect(t.awaiting).toHaveBeenCalledTimes(1);
  });

  it("is idempotent even when two deliveries race past the first check", async () => {
    const t = setup();
    vi.mocked(t.repository.isKnownProviderMessage).mockResolvedValue(false);
    await t.service.handle(mail());
    expect(await t.service.handle(mail())).toEqual({ outcome: "duplicate" });
    expect(t.notifyReply).toHaveBeenCalledTimes(1);
  });

  it("falls back to In-Reply-To when no address names a thread", async () => {
    const t = setup({ outboundTarget: TARGET });
    const result = await t.service.handle(
      mail({
        ToFull: [{ Email: "replies@inbound.example.test" }],
        OriginalRecipient: "replies@inbound.example.test",
        Headers: [{ Name: "In-Reply-To", Value: "<AbC-123@mtasv.net>" }],
      }),
    );
    expect(result.outcome).toBe("stored");
    expect(t.inbound.get("pm-1")?.matchedBy).toBe("in_reply_to");
    expect(t.repository.findTargetByOutboundMessageIds).toHaveBeenCalledWith(["abc-123"]);
  });

  it("quarantines mail that names no thread and quotes no known message", async () => {
    const t = setup();
    const result = await t.service.handle(
      mail({ ToFull: [{ Email: "replies@inbound.example.test" }], OriginalRecipient: "" }),
    );
    expect(result).toEqual({ outcome: "quarantined", reason: "unmatched" });
    expect(t.inbound.size).toBe(0);
    expect(t.held.get("pm-1")).toMatchObject({ reason: "unmatched" });
    expect(t.published[0]?.eventType).toBe("marketing_enquiry.inbound_quarantined");
    expect(t.notifyReply).not.toHaveBeenCalled();
  });

  it("quarantines a forged reply address, and never attaches it to the thread", async () => {
    const t = setup();
    const forged = addresses.addressFor(ID).replace(/-[0-9a-f]{24}@/, `-${"0".repeat(24)}@`);
    const result = await t.service.handle(
      mail({ ToFull: [{ Email: forged }], OriginalRecipient: forged }),
    );
    expect(result).toEqual({ outcome: "quarantined", reason: "bad_token" });
    expect(t.inbound.size).toBe(0);
    expect(t.repository.findTargetById).not.toHaveBeenCalled();
  });

  it("quarantines a valid address whose thread is gone", async () => {
    const t = setup({ target: null });
    expect(await t.service.handle(mail())).toEqual({ outcome: "quarantined", reason: "unmatched" });
  });

  it("quarantines a spoofed sender even with a valid address", async () => {
    const t = setup();
    const result = await t.service.handle(
      mail({ From: "evil@attacker.test", FromFull: { Email: "evil@attacker.test" } }),
    );
    expect(result).toEqual({ outcome: "quarantined", reason: "sender_mismatch" });
    expect(t.inbound.size).toBe(0);
    expect(t.held.get("pm-1")?.suspectedEnquiryId).toBe(ID);
    expect(t.awaiting).not.toHaveBeenCalled();
  });

  it("quarantines mail that failed SPF", async () => {
    const t = setup();
    const result = await t.service.handle(
      mail({
        Headers: [{ Name: "Received-SPF", Value: "Fail (domain does not designate sender)" }],
      }),
    );
    expect(result).toEqual({ outcome: "quarantined", reason: "spf_failed" });
  });

  it("quarantines automatic replies", async () => {
    const t = setup();
    const result = await t.service.handle(
      mail({ Headers: [{ Name: "Auto-Submitted", Value: "auto-replied" }] }),
    );
    expect(result).toEqual({ outcome: "quarantined", reason: "auto_reply" });
  });

  it("stores plain text only: markup in an HTML-only reply is stripped", async () => {
    const t = setup();
    await t.service.handle(
      mail({
        StrippedTextReply: undefined,
        TextBody: undefined,
        HtmlBody: "<p>Hi<script>x()</script></p><img src=x onerror=alert(1)>",
      }),
    );
    const body = t.inbound.get("pm-1")?.body ?? "";
    expect(body).toBe("Hi");
  });

  it("keeps a failed staff alert from losing the stored reply", async () => {
    const t = setup();
    t.notifyReply.mockRejectedValueOnce(new Error("queue down"));
    expect((await t.service.handle(mail())).outcome).toBe("stored");
  });

  it("caps attachment metadata and long values", async () => {
    const t = setup();
    await t.service.handle(
      mail({
        Subject: "s".repeat(1000),
        TextBody: "b".repeat(50_000),
        StrippedTextReply: undefined,
        Attachments: Array.from({ length: 40 }, (_, i) => ({
          Name: `f${i}`,
          ContentType: "x/y",
          ContentLength: i,
        })),
      }),
    );
    const stored = t.inbound.get("pm-1");
    expect(stored?.subject.length).toBeLessThanOrEqual(300);
    expect(stored?.body.length).toBeLessThanOrEqual(20_000);
    expect(stored?.attachments).toHaveLength(20);
  });
});
