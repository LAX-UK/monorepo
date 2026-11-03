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
      template: "visitor-alert-confirm",
      to: "ada@example.com",
      vars: vars as never,
      stream: "transactional",
      flaggedAddress: false,
    });

  it("puts the one-click address in List-Unsubscribe when the email names one", async () => {
    await send({
      confirmUrl: "https://lax.bid/alerts/confirm?t=a",
      expirationHours: 48,
      unsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=u",
      listUnsubscribeUrl: "https://api.lax.bid/sale-alerts/unsubscribe?t=u",
    });
    expect(sendEmail.mock.calls.at(-1)?.[0].Headers).toEqual([
      { Name: "List-Unsubscribe", Value: "<https://api.lax.bid/sale-alerts/unsubscribe?t=u>" },
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
