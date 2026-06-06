import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env.js";
import { createTransactionalMailer } from "./transactional-mailer.js";

const sendEmail = vi.fn().mockResolvedValue({ MessageID: "pm-1" });

vi.mock("postmark", () => ({
  default: {
    ServerClient: vi.fn().mockImplementation(() => ({ sendEmail })),
  },
}));

const baseEnv = {
  EMAIL_PROVIDER: "console",
  EMAIL_FROM: "LAX <no-reply@mail.lax.bid>",
  EMAIL_REPLY_TO: "support@lax.bid",
  POSTMARK_TRANSACTIONAL_STREAM: "outbound",
  POSTMARK_BROADCAST_STREAM: "broadcast",
} as Env;

describe("createTransactionalMailer", () => {
  beforeEach(() => {
    sendEmail.mockClear();
  });

  it("uses Postmark when EMAIL_PROVIDER=postmark and token is set", async () => {
    const mailer = createTransactionalMailer({
      ...baseEnv,
      EMAIL_PROVIDER: "postmark",
      POSTMARK_SERVER_TOKEN: "pm-token",
      INVITE_EMAIL_FROM: "LAX Events <events@lax.bid>",
    });

    await mailer.send({
      to: "guest@example.com",
      subject: "Your pass",
      text: "plain",
      html: "<p>html</p>",
      meta: { kind: "onsite_event_rsvp_confirmed", rsvpId: "r1" },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        From: "LAX Events <events@lax.bid>",
        To: "guest@example.com",
        Subject: "Your pass",
        TextBody: "plain",
        HtmlBody: "<p>html</p>",
        MessageStream: "outbound",
        Tag: "onsite_event_rsvp_confirmed",
        Metadata: { kind: "onsite_event_rsvp_confirmed", rsvpId: "r1" },
        ReplyTo: "support@lax.bid",
      }),
    );
  });

  it("falls back to EMAIL_FROM when INVITE_EMAIL_FROM is unset", async () => {
    const mailer = createTransactionalMailer({
      ...baseEnv,
      EMAIL_PROVIDER: "postmark",
      POSTMARK_SERVER_TOKEN: "pm-token",
    });

    await mailer.send({
      to: "guest@example.com",
      subject: "Invite",
      text: "plain",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        From: "LAX <no-reply@mail.lax.bid>",
      }),
    );
  });

  it("sends inline CID attachments through Postmark", async () => {
    const mailer = createTransactionalMailer({
      ...baseEnv,
      EMAIL_PROVIDER: "postmark",
      POSTMARK_SERVER_TOKEN: "pm-token",
    });

    await mailer.send({
      to: "guest@example.com",
      subject: "Your pass",
      text: "plain",
      html: '<img src="cid:onsite-pass-qr" alt="QR">',
      inlineAttachments: [
        {
          contentId: "onsite-pass-qr",
          filename: "entry-pass-qr.png",
          contentType: "image/png",
          contentBase64: "abc123",
        },
      ],
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        Attachments: [
          {
            Name: "entry-pass-qr.png",
            Content: "abc123",
            ContentType: "image/png",
            ContentID: "cid:onsite-pass-qr",
          },
        ],
      }),
    );
  });

  it("prefers Postmark over INVITE_EMAIL_WEBHOOK_URL when both are configured", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const mailer = createTransactionalMailer({
      ...baseEnv,
      EMAIL_PROVIDER: "postmark",
      POSTMARK_SERVER_TOKEN: "pm-token",
      INVITE_EMAIL_WEBHOOK_URL: "https://example.com/webhook",
    });

    await mailer.send({
      to: "guest@example.com",
      subject: "Pass",
      text: "plain",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
