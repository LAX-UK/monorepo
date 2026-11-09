import { describe, expect, it, vi } from "vitest";
import { PostmarkEmailSender, postmarkMetadataUnsubscribeToken } from "./postmark-email.sender.js";

const sendEmail = vi.fn().mockResolvedValue({ MessageID: "m1" });
vi.mock("postmark", () => ({
  default: { ServerClient: vi.fn().mockImplementation(() => ({ sendEmail })) },
}));

describe("postmarkMetadataUnsubscribeToken", () => {
  it("returns the token query param when within Postmark metadata limits", () => {
    expect(postmarkMetadataUnsubscribeToken("https://lax.bid/unsubscribe?t=short-token")).toBe(
      "short-token",
    );
  });

  it("omits tokens longer than 80 characters", () => {
    const longToken = "x".repeat(81);
    expect(
      postmarkMetadataUnsubscribeToken(`https://lax.bid/unsubscribe?t=${longToken}`),
    ).toBeNull();
  });
});

describe("PostmarkEmailSender one-click unsubscribe", () => {
  const sender = new PostmarkEmailSender({
    serverToken: "t",
    from: "bid@lax.example",
    transactionalStream: "outbound",
    broadcastStream: "broadcast",
  });
  const send = (vars: Record<string, unknown>) =>
    sender.send({
      outboxId: "o1",
      template: "alert-confirm",
      to: "ada@example.com",
      vars: { product: "bid", ...vars } as never,
      stream: "transactional",
      flaggedAddress: false,
    });

  it("puts the one-click address in List-Unsubscribe when the email names one", async () => {
    await send({
      confirmUrl: "https://lax.bid/alerts/confirm?t=a",
      expirationHours: 48,
      unsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=u",
      listUnsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=u",
    });
    expect(sendEmail.mock.calls.at(-1)?.[0].Headers).toEqual([
      { Name: "List-Unsubscribe", Value: "<https://lax.bid/alerts/unsubscribe?t=u>" },
      { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
    ]);
  });

  it("falls back to the unsubscribe link in the body", async () => {
    await send({
      confirmUrl: "https://lax.bid/alerts/confirm?t=a",
      expirationHours: 48,
      unsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=u",
    });
    expect(sendEmail.mock.calls.at(-1)?.[0].Headers?.[0]?.Value).toBe(
      "<https://lax.bid/alerts/unsubscribe?t=u>",
    );
  });
});

describe("PostmarkEmailSender From by product", () => {
  const sender = new PostmarkEmailSender({
    serverToken: "t",
    from: "LAX <no-reply@mail.lax.bid>",
    fromByProduct: { bid: "alerts@mail.lax.bid", shop: "alerts@mail.lax.art" },
    transactionalStream: "outbound",
    broadcastStream: "broadcast",
  });
  const sendAs = (product: "bid" | "shop" | "art") =>
    sender.send({
      outboxId: "o1",
      template: "alert-digest",
      to: "ada@example.com",
      vars: {
        product,
        subject: "New sale",
        title: "A new sale",
        dateLabel: "Wednesday 4 November",
        groups: [],
        reason: "You asked for alerts.",
        unsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=u",
        listUnsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=u",
        stopLabel: "Stop these emails",
      } as never,
      stream: "broadcast",
      flaggedAddress: false,
    });

  it("sends each product's mail from its own name and address", async () => {
    await sendAs("bid");
    expect(sendEmail.mock.calls.at(-1)?.[0].From).toBe("LAX Bid <alerts@mail.lax.bid>");
    await sendAs("shop");
    expect(sendEmail.mock.calls.at(-1)?.[0].From).toBe("LAX Shop <alerts@mail.lax.art>");
  });

  it("uses the stream the email asked for", async () => {
    await sendAs("bid");
    expect(sendEmail.mock.calls.at(-1)?.[0].MessageStream).toBe("broadcast");
  });

  it("falls back to EMAIL_FROM for a product with no entry", async () => {
    await sendAs("art");
    expect(sendEmail.mock.calls.at(-1)?.[0].From).toBe("LAX <no-reply@mail.lax.bid>");
  });
});

describe("PostmarkEmailSender calendar attachment", () => {
  const sender = new PostmarkEmailSender({
    serverToken: "t",
    from: "bid@lax.example",
    transactionalStream: "outbound",
    broadcastStream: "broadcast",
  });
  const visit = {
    userName: "Maya",
    reference: "COL-4821",
    whenLabel: "Thu 12 Nov, 14:00\u201314:30 GMT",
    placeName: "London Art Exchange",
    address: "156 New Cavendish Street, London W1W 6YW",
    lots: ["Lot 12 \u00b7 Lowland Storm"],
    collectorName: "Maya Okafor",
    collectorIsOther: false,
    bookingUrl: "https://lax.bid/purchases",
  };

  it("attaches the calendar file with its method, so the mail client adds or removes the entry", async () => {
    await sender.send({
      outboxId: "o2",
      template: "collection-booked",
      to: "maya@example.com",
      vars: {
        ...visit,
        calendar: {
          filename: "collection-COL-4821.ics",
          method: "REQUEST",
          content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        },
      },
      stream: "transactional",
      flaggedAddress: false,
    });
    const message = sendEmail.mock.calls.at(-1)?.[0];
    expect(message.Subject).toBe("Collection booked: Thu 12 Nov, 14:00\u201314:30 GMT");
    expect(message.Attachments).toEqual([
      {
        Name: "collection-COL-4821.ics",
        Content: Buffer.from("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n").toString("base64"),
        ContentType: "text/calendar; method=REQUEST; charset=UTF-8",
        ContentID: null,
      },
    ]);
  });

  it("sends no attachment when the email has no calendar file", async () => {
    await sender.send({
      outboxId: "o3",
      template: "collection-booked",
      to: "maya@example.com",
      vars: visit,
      stream: "transactional",
      flaggedAddress: false,
    });
    expect(sendEmail.mock.calls.at(-1)?.[0].Attachments).toBeUndefined();
  });
});
