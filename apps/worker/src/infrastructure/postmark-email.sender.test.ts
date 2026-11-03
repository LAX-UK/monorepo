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
