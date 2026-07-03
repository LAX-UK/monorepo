import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";
import { OnsiteEventNotifier } from "./onsite-event-notifier.js";
import type { PassQrRenderService } from "./pass-qr-render.service.js";

const event: OnsiteEvent = {
  slug: "lax001",
  title: "LAX 001",
  startsAt: new Date("2026-06-18T18:00:00.000Z"),
  rsvpCloseAt: new Date("2026-06-18T16:00:00.000Z"),
  segmentOptions: [{ value: "full_evening", label: "Full evening" }],
  opsEmail: "events@lax.bid",
  micrositeUrl: "https://event.lax.bid",
  venue: "Brunswick Art Gallery & Centre, London",
  dressCode: "Smart formal",
  arrivalNote: "Doors 6:00 PM · Personal and non-transferable.",
  status: "published",
  checkInDryRun: false,
  saleId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const rsvp: OnsiteEventRsvp = {
  id: "rsvp-1",
  eventSlug: "lax001",
  userId: "user-1",
  attendanceSegment: "full_evening",
  plusOne: 0,
  plusOneGuestName: null,
  notes: null,
  checkInTokenHash: "hash",
  checkInTokenIssuedAt: new Date(),
  checkInTokenCiphertext: "v1:abc",
  checkedInAt: null,
  checkedInByUserId: null,
  checkInPartyCount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("OnsiteEventNotifier", () => {
  it("sends HTML pass email on confirm", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const mailer: ITransactionalMailer = { send };
    const qrRender = {
      renderPngBase64: vi.fn().mockResolvedValue("base64png"),
    } as unknown as PassQrRenderService;
    const notifier = new OnsiteEventNotifier(mailer, qrRender, "events@lax.bid");

    await notifier.notifySubmitted(event, rsvp, {
      userEmail: "guest@example.com",
      userName: "Guest",
      passUrl: "https://event.lax.bid/pass/token",
    });

    expect(send).toHaveBeenCalled();
    const guestMail = send.mock.calls[0]?.[0];
    expect(guestMail?.html).toContain('src="cid:onsite-pass-qr"');
    expect(guestMail?.html).not.toContain("data:image/png");
    expect(guestMail?.inlineAttachments).toEqual([
      {
        contentId: "onsite-pass-qr",
        filename: "entry-pass-qr.png",
        contentType: "image/png",
        contentBase64: "base64png",
      },
    ]);
    expect(guestMail?.text).toContain("Smart formal");
  });

  it("throws when resent guest email fails", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("webhook down"))
      .mockResolvedValue(undefined);
    const mailer: ITransactionalMailer = { send };
    const qrRender = {
      renderPngBase64: vi.fn().mockResolvedValue("base64png"),
    } as unknown as PassQrRenderService;
    const notifier = new OnsiteEventNotifier(mailer, qrRender, "events@lax.bid");

    await expect(
      notifier.notifyResent(event, rsvp, {
        userEmail: "guest@example.com",
        userName: "Guest",
        passUrl: "https://event.lax.bid/pass/token",
      }),
    ).rejects.toThrow("webhook down");
  });
});
