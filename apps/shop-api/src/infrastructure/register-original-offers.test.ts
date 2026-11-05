import {
  ArtworkOfferLock,
  ArtworkOfferedElsewhereError,
  type ArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";
import type { OfferedArtwork } from "../application/ports/original-offer-register.js";
import { createRegisterOriginalOffers } from "./register-original-offers.js";

const session = {} as Database;
const original: OfferedArtwork = {
  id: "art-1",
  zohoProductId: "5001",
  salesChannel: "art",
  runKind: null,
};

function lockOver(entry: Partial<ArtworkRegisterEntry> | null) {
  const full = entry
    ? ({
        id: "reg-1",
        kind: "original",
        offer: { state: "held", ref: null },
        version: 1,
        ...entry,
      } as ArtworkRegisterEntry)
    : null;
  const register = {
    findById: vi.fn().mockResolvedValue(full),
    findByZohoProductId: vi.fn().mockResolvedValue(full),
    moveOffer: vi.fn().mockResolvedValue({ ok: true, entry: full }),
  };
  return { register, lock: () => new ArtworkOfferLock(register) };
}

describe("createRegisterOriginalOffers", () => {
  it("looks up the entry by the artwork's Zoho Product id and records the offer on lax.art", async () => {
    const { register, lock } = lockOver({});
    await createRegisterOriginalOffers(lock).recordPublished(session, original, "staff:u1");
    expect(register.findByZohoProductId).toHaveBeenCalledWith("5001");
    expect(register.moveOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lax_art",
        ref: { kind: "shop_artwork", id: "art-1" },
        actor: "staff:u1",
      }),
    );
  });

  it("does nothing for an artwork with no Zoho Product id", async () => {
    const { register, lock } = lockOver({});
    const offers = createRegisterOriginalOffers(lock);
    await offers.assertCanPublish(session, { ...original, zohoProductId: null });
    await offers.recordPublished(session, { ...original, zohoProductId: null }, "staff:u1");
    expect(register.findByZohoProductId).not.toHaveBeenCalled();
    expect(register.moveOffer).not.toHaveBeenCalled();
  });

  it("does nothing for an edition or an artwork not sold on lax.art", async () => {
    const { register, lock } = lockOver({});
    const offers = createRegisterOriginalOffers(lock);
    await offers.recordPublished(session, { ...original, runKind: "limited" }, "staff:u1");
    await offers.recordPublished(session, { ...original, salesChannel: "shop" }, "staff:u1");
    expect(register.moveOffer).not.toHaveBeenCalled();
  });

  it("does nothing when the Zoho Product is not in the register yet", async () => {
    const { register, lock } = lockOver(null);
    const offers = createRegisterOriginalOffers(lock);
    await offers.assertCanPublish(session, original);
    await offers.recordSold(session, original, "system");
    expect(register.moveOffer).not.toHaveBeenCalled();
  });

  it("refuses to publish an original offered elsewhere, in the register's words, as a domain error", async () => {
    const { lock } = lockOver({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "l1" } } });
    const refusal = createRegisterOriginalOffers(lock).assertCanPublish(session, original);
    await expect(refusal).rejects.toBeInstanceOf(ShopDomainError);
    await expect(refusal).rejects.toThrow(
      "This artwork is already offered in a LAX Bid sale. Withdraw it there first.",
    );
    expect(new ArtworkOfferedElsewhereError("offered_elsewhere", "bid_sale").code).toBe(
      "artwork_offered_elsewhere",
    );
  });

  it("withdraws on unpublish and marks sold on a paid sale", async () => {
    const offered = {
      offer: { state: "lax_art", ref: { kind: "shop_artwork", id: "art-1" } },
    } as const;
    const { register, lock } = lockOver(offered);
    const offers = createRegisterOriginalOffers(lock);
    await offers.recordWithdrawn(session, original, "staff:u1");
    await offers.recordSold(session, original, "system");
    expect(register.moveOffer.mock.calls.map(([input]) => input.to)).toEqual(["withdrawn", "sold"]);
  });
});
