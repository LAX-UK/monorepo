import { ArtworkOfferLock, type ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import type { LotRegisterLink } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../lib/errors.js";
import type { LotLifecycleEventRecorder } from "./lot-lifecycle-event-recorder.js";
import { OfferLockLotLifecycleRecording } from "./offer-lock-lot-lifecycle-recording.service.js";

const tx = {} as Database;
const lotRow = {
  id: "lot-1",
  status: "scheduled" as const,
  saleId: "11111111-1111-4111-8111-111111111111",
  sellerLegalEntityId: "22222222-2222-4222-8222-222222222222",
};

function setup(options: { link: LotRegisterLink | null; entry?: Partial<ArtworkRegisterEntry> }) {
  const entry = {
    id: "reg-1",
    kind: "original",
    offer: { state: "held", ref: null },
    version: 1,
    ...options.entry,
  } as ArtworkRegisterEntry;
  const register = {
    findById: vi.fn().mockResolvedValue(entry),
    findByZohoProductId: vi.fn().mockResolvedValue(entry),
    moveOffer: vi.fn().mockResolvedValue({ ok: true, entry }),
  };
  const journal = { record: vi.fn().mockResolvedValue(undefined) };
  const recording = new OfferLockLotLifecycleRecording(
    journal as unknown as LotLifecycleEventRecorder,
    new ArtworkOfferLock(register),
    { findLink: vi.fn().mockResolvedValue(options.link) },
  );
  return { recording, register, journal };
}

const link: LotRegisterLink = {
  registerId: "reg-1",
  status: "scheduled",
  hasWinner: false,
  soldOnAtg: false,
};

describe("OfferLockLotLifecycleRecording.recordPublished", () => {
  it("records the lot's publish and the offer on Bid for a linked lot", async () => {
    const { recording, register, journal } = setup({ link });
    await recording.recordPublished(tx, lotRow, "user-1");
    expect(journal.record).toHaveBeenCalledOnce();
    expect(register.moveOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        registerId: "reg-1",
        to: "bid_sale",
        ref: { kind: "bid_lot", id: "lot-1" },
        actor: "staff:user-1",
      }),
    );
  });

  it("publishes a lot with no register link exactly as before", async () => {
    const { recording, register, journal } = setup({ link: null });
    await recording.recordPublished(tx, lotRow, "user-1");
    expect(journal.record).toHaveBeenCalledOnce();
    expect(register.moveOffer).not.toHaveBeenCalled();
  });

  it("refuses, with a conflict staff can read, when the artwork is offered on lax.art", async () => {
    const { recording, register } = setup({
      link,
      entry: { offer: { state: "lax_art", ref: { kind: "shop_artwork", id: "art-1" } } },
    });
    const refusal = recording.recordPublished(tx, lotRow, "user-1");
    await expect(refusal).rejects.toBeInstanceOf(LotError);
    await expect(refusal).rejects.toMatchObject({
      message:
        "This artwork is live on lax.art. Take it off lax.art first, or use Offer at auction to move it.",
      status: 409,
      code: "artwork_offered_elsewhere",
    });
    expect(register.moveOffer).not.toHaveBeenCalled();
  });
});
