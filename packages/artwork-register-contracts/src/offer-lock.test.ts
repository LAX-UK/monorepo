import { describe, expect, it } from "vitest";
import type { ArtworkRegisterEntry } from "./entry.js";
import {
  ArtworkOfferLock,
  ArtworkOfferMoveError,
  ArtworkOfferedElsewhereError,
  type OfferLockRegister,
  checkOfferable,
  offerRefusalMessage,
} from "./offer-lock.js";
import { type OfferRef, type OfferState, transitionOffer } from "./offer-state.js";

const shop: OfferRef = { kind: "shop_artwork", id: "art-1" };
const lot: OfferRef = { kind: "bid_lot", id: "lot-1" };
const otherLot: OfferRef = { kind: "bid_lot", id: "lot-2" };

function entry(
  state: OfferState,
  ref: OfferRef | null = null,
  over: Partial<ArtworkRegisterEntry> = {},
): ArtworkRegisterEntry {
  return {
    id: "reg-1",
    zohoProductId: "z-1",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Untitled",
    artist: { zohoArtistId: null, name: "A", code: "GAC" },
    medium: null,
    dimensions: null,
    year: null,
    imageRefs: [],
    catalogueStatus: null,
    offer: { state, ref },
    zohoModifiedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    version: 1,
    ...over,
  };
}

/** A register that applies the real transition rules and counts moves. */
function fakeRegister(initial: ArtworkRegisterEntry | null, conflictsBefore = 0) {
  let current = initial;
  let conflicts = conflictsBefore;
  const moves: Array<{ to: OfferState; ref: OfferRef | null; actor: string }> = [];
  const register: OfferLockRegister = {
    findById: async () => current,
    findByZohoProductId: async () => current,
    moveOffer: async (input) => {
      if (!current) return { ok: false, reason: "not_found" };
      if (conflicts > 0) {
        conflicts -= 1;
        current = { ...current, version: current.version + 1 };
        return { ok: false, reason: "version_conflict" };
      }
      const move = transitionOffer(current.offer.state, input.to, input.ref);
      if (!move.ok) return { ok: false, reason: move.reason };
      moves.push({ to: input.to, ref: input.ref, actor: input.actor });
      current = {
        ...current,
        offer: { state: move.state, ref: move.ref },
        version: current.version + 1,
      };
      return { ok: true, entry: current };
    },
  };
  return { register, moves, state: () => current?.offer };
}

const link = { zohoProductId: "z-1" };
const lock = (register: OfferLockRegister) => new ArtworkOfferLock(register, () => new Date(0));

describe("checkOfferable", () => {
  it("allows a held or withdrawn original", () => {
    expect(checkOfferable(entry("held"), shop).ok).toBe(true);
    expect(checkOfferable(entry("withdrawn"), lot).ok).toBe(true);
  });

  it("allows the place that already holds the offer, not another lot there", () => {
    expect(checkOfferable(entry("bid_sale", lot), lot).ok).toBe(true);
    expect(checkOfferable(entry("bid_sale", lot), otherLot).ok).toBe(false);
  });

  it("refuses an artwork offered in another place, in plain words", () => {
    const result = checkOfferable(entry("lax_art", shop), lot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(
        "This artwork is live on lax.art. Take it off lax.art first, or use Offer at auction to move it.",
      );
      expect(result.error.lock.link).toEqual({
        label: "Open on lax.art",
        target: "lax_art_listing",
      });
    }
    expect(offerRefusalMessage("offered_elsewhere", "bid_sale")).toBe(
      "This artwork is in a LAX Bid sale. Withdraw the lot there first.",
    );
    expect(
      offerRefusalMessage("offered_elsewhere", "bid_sale", {
        saleName: "Winter Modern and Contemporary",
        lotNumber: 14,
      }),
    ).toBe(
      "This artwork is in a LAX Bid sale (Winter Modern and Contemporary, lot 14). Withdraw the lot there first.",
    );
    expect(offerRefusalMessage("offered_elsewhere", "private_sale")).toBe(
      "This artwork is in a private sale. Withdraw it there first.",
    );
  });

  it("tells a sale through LAX from a sale in the gallery", () => {
    const lax = checkOfferable(entry("sold", shop), lot);
    const gallery = checkOfferable(entry("sold", null), lot);
    expect(!lax.ok && lax.error.message).toBe(
      "This artwork has been sold, so it can't be offered again.",
    );
    expect(!gallery.ok && gallery.error.reason).toBe("sold_in_gallery");
    expect(!gallery.ok && gallery.error.message).toBe(
      "Zoho shows this artwork as sold in the gallery, so it can't be offered.",
    );
  });

  it("refuses a held artwork Zoho shows as sold, before the sale reaches the register", () => {
    for (const status of ["Sold", " sold "]) {
      const result = checkOfferable(entry("held", null, { catalogueStatus: status }), shop);
      expect(!result.ok && result.error.reason).toBe("sold_in_gallery");
    }
  });

  it("refuses a new offer on an artwork reserved in Zoho, but not one already offered here", () => {
    const held = checkOfferable(entry("held", null, { catalogueStatus: "Reserved" }), shop);
    expect(!held.ok && held.error.reason).toBe("reserved_in_zoho");
    expect(!held.ok && held.error.lock.link?.target).toBe("zoho_record");
    const withdrawn = checkOfferable(
      entry("withdrawn", null, { catalogueStatus: "Reserved" }),
      lot,
    );
    expect(withdrawn.ok).toBe(false);
    expect(checkOfferable(entry("lax_art", shop, { catalogueStatus: "Reserved" }), shop).ok).toBe(
      true,
    );
    expect(checkOfferable(entry("held", null, { catalogueStatus: "Available" }), shop).ok).toBe(
      true,
    );
  });

  it("refuses a sold artwork", () => {
    const result = checkOfferable(entry("sold", shop), lot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe("sold");
  });

  it("does not govern prints", () => {
    expect(checkOfferable(entry("sold", shop, { kind: "print" }), lot).ok).toBe(true);
  });
});

describe("ArtworkOfferLock", () => {
  it("does nothing for an artwork with no register link or entry", async () => {
    const { register, moves } = fakeRegister(null);
    expect(await lock(register).offer(null, shop, "system")).toEqual({ status: "not_governed" });
    expect(await lock(register).offer(link, shop, "system")).toEqual({ status: "not_governed" });
    await expect(lock(register).assertCanOffer(link, shop)).resolves.toBeUndefined();
    expect(moves).toEqual([]);
  });

  it("does nothing for a print", async () => {
    const { register, moves } = fakeRegister(entry("held", null, { kind: "print" }));
    expect((await lock(register).offer(link, shop, "system")).status).toBe("not_governed");
    expect(moves).toEqual([]);
  });

  it("moves a held artwork to the place with its reference and the actor", async () => {
    const { register, moves } = fakeRegister(entry("held"));
    const outcome = await lock(register).offer(link, lot, "staff:u1");
    expect(outcome.status).toBe("moved");
    expect(moves).toEqual([{ to: "bid_sale", ref: lot, actor: "staff:u1" }]);
  });

  it("refuses to offer an artwork that is offered elsewhere", async () => {
    const { register, moves } = fakeRegister(entry("lax_art", shop));
    await expect(lock(register).offer(link, lot, "system")).rejects.toBeInstanceOf(
      ArtworkOfferedElsewhereError,
    );
    expect(moves).toEqual([]);
  });

  it("records an offer made twice once", async () => {
    const { register, moves } = fakeRegister(entry("bid_sale", lot));
    expect((await lock(register).offer(link, lot, "system")).status).toBe("unchanged");
    expect(moves).toEqual([]);
  });

  it("withdraws only the offer it made", async () => {
    const mine = fakeRegister(entry("bid_sale", lot));
    expect((await lock(mine.register).withdraw(link, lot, "system")).status).toBe("moved");
    expect(mine.state()).toEqual({ state: "withdrawn", ref: null });

    const theirs = fakeRegister(entry("lax_art", shop));
    expect((await lock(theirs.register).withdraw(link, lot, "system")).status).toBe("unchanged");
    expect(theirs.state()?.state).toBe("lax_art");

    const idle = fakeRegister(entry("held"));
    expect((await lock(idle.register).withdraw(link, lot, "system")).status).toBe("unchanged");
  });

  it("marks an offered artwork sold and keeps the sale's reference", async () => {
    const { register, state } = fakeRegister(entry("bid_sale", lot));
    expect((await lock(register).markSold(link, lot, "system")).status).toBe("moved");
    expect(state()).toEqual({ state: "sold", ref: lot });
  });

  it("is terminal: a second sale record changes nothing", async () => {
    const { register, moves } = fakeRegister(entry("sold", lot));
    expect((await lock(register).markSold(link, lot, "system")).status).toBe("unchanged");
    expect((await lock(register).markSold(link, shop, "system")).status).toBe("skipped");
    expect(moves).toEqual([]);
  });

  it("records a sale through the place when the offer was never recorded", async () => {
    const { register, moves } = fakeRegister(entry("held"));
    expect((await lock(register).markSold(link, shop, "system")).status).toBe("moved");
    expect(moves.map((m) => m.to)).toEqual(["lax_art", "sold"]);
  });

  it("reports, without forcing, a sale the register places elsewhere", async () => {
    const { register, moves } = fakeRegister(entry("lax_art", shop));
    const outcome = await lock(register).markSold(link, lot, "system");
    expect(outcome.status).toBe("skipped");
    expect(moves).toEqual([]);
  });

  it("reads again and retries when another change got in first", async () => {
    const { register, moves } = fakeRegister(entry("held"), 2);
    expect((await lock(register).offer(link, lot, "system")).status).toBe("moved");
    expect(moves).toHaveLength(1);
  });

  it("gives up after repeated conflicts", async () => {
    const { register } = fakeRegister(entry("held"), 5);
    await expect(lock(register).offer(link, lot, "system")).rejects.toBeInstanceOf(
      ArtworkOfferMoveError,
    );
  });
});
