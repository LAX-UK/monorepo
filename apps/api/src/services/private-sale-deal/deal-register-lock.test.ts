import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  type OfferLockRegister,
} from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import {
  ArtworkRegisterDealLock,
  DealArtworkRefused,
  REGISTER_EFFECT_BY_STAGE,
  staffOrSystem,
} from "./deal-register-lock.js";

type Offer = ArtworkRegisterEntry["offer"];

function entryWith(offer: Offer, kind: "original" | "print" = "original"): ArtworkRegisterEntry {
  return { id: "reg-1", kind, version: 1, catalogueStatus: null, offer } as never;
}

/** A register that applies moves for real, so the sequence of states can be read back. */
function memoryRegister(initial: ArtworkRegisterEntry) {
  let entry = initial;
  const port: OfferLockRegister = {
    findById: async () => entry,
    findByZohoProductId: async () => entry,
    moveOffer: async ({ to, ref }) => {
      entry = {
        ...entry,
        version: entry.version + 1,
        offer: { ...entry.offer, state: to, ref },
      } as never;
      return { ok: true, entry };
    },
  };
  return { lock: new ArtworkRegisterDealLock(new ArtworkOfferLock(port)), read: () => entry.offer };
}

const HELD: Offer = { state: "held", ref: null } as never;

describe("ArtworkRegisterDealLock", () => {
  it("holds the artwork for the deal, and a repeat changes nothing", async () => {
    const { lock, read } = memoryRegister(entryWith(HELD));
    await lock.offer("reg-1", "deal-1", "staff:u");
    await lock.offer("reg-1", "deal-1", "staff:u");
    expect(read()).toMatchObject({
      state: "private_sale",
      ref: { kind: "private_sale", id: "deal-1" },
    });
  });

  it("refuses an artwork live on lax.art or in a Bid sale, in the register's words", async () => {
    for (const [state, kind, phrase] of [
      ["lax_art", "shop_artwork", "lax.art"],
      ["bid_sale", "bid_lot", "LAX Bid"],
    ] as const) {
      const { lock } = memoryRegister(entryWith({ state, ref: { kind, id: "x" } } as never));
      const error = await lock.offer("reg-1", "deal-1", "staff:u").catch((e) => e);
      expect(error).toBeInstanceOf(DealArtworkRefused);
      expect((error as Error).message).toContain(phrase);
    }
  });

  it("refuses an artwork already held by another deal", async () => {
    const { lock } = memoryRegister(
      entryWith({ state: "private_sale", ref: { kind: "private_sale", id: "deal-2" } } as never),
    );
    await expect(lock.offer("reg-1", "deal-1", "staff:u")).rejects.toBeInstanceOf(
      DealArtworkRefused,
    );
  });

  it("withdraws the deal's own hold, and leaves another deal's hold alone", async () => {
    const own = memoryRegister(entryWith(HELD));
    await own.lock.offer("reg-1", "deal-1", "staff:u");
    await own.lock.withdraw("reg-1", "deal-1", "staff:u");
    expect(own.read().state).toBe("withdrawn");

    const other = memoryRegister(
      entryWith({ state: "private_sale", ref: { kind: "private_sale", id: "deal-2" } } as never),
    );
    await other.lock.withdraw("reg-1", "deal-1", "staff:u");
    expect(other.read().state).toBe("private_sale");
  });

  it("marks the artwork sold through the deal, and a repeat changes nothing", async () => {
    const { lock, read } = memoryRegister(entryWith(HELD));
    await lock.offer("reg-1", "deal-1", "staff:u");
    await lock.markSold("reg-1", "deal-1", "system");
    await lock.markSold("reg-1", "deal-1", "system");
    expect(read()).toMatchObject({ state: "sold", ref: { kind: "private_sale", id: "deal-1" } });
  });

  it("does not govern a print", async () => {
    const { lock, read } = memoryRegister(entryWith(HELD, "print"));
    await lock.offer("reg-1", "deal-1", "staff:u");
    expect(read().state).toBe("held");
  });
});

describe("register effects", () => {
  it("follows payment with a sale, never blocking the payment, and cancellation with a withdrawal", () => {
    expect(REGISTER_EFFECT_BY_STAGE.paid).toEqual({ move: "markSold", blocking: false });
    expect(REGISTER_EFFECT_BY_STAGE.cancelled).toEqual({ move: "withdraw", blocking: true });
    expect(REGISTER_EFFECT_BY_STAGE.settled).toBeUndefined();
  });

  it("names staff, or the system when nobody acted", () => {
    expect(staffOrSystem("u-1")).toBe("staff:u-1");
    expect(staffOrSystem(null)).toBe("system");
  });
});
