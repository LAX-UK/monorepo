import { type ArtworkRegisterEntry, lockMessage } from "@auction/artwork-register-contracts";
import type { PrivateSaleArtworkChange, PrivateSaleDealDetail } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { DealArtworkService } from "./deal-artwork.service.js";
import { makeDeal } from "./deal-fixtures.test-util.js";
import { DealArtworkRefused, DealRegisterUnavailable } from "./deal-register-lock.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";

const OLD = "00000000-0000-4000-8000-000000000001";
const NEW = "00000000-0000-4000-8000-000000000002";

const viewer = (
  manage = true,
  scope: DealStaffViewer["scope"] = { kind: "all" },
): DealStaffViewer => ({
  userId: "u-staff",
  abilities: { manage, finance: false, release: false },
  checks: true,
  scope,
});

const entry = (over: Partial<ArtworkRegisterEntry> = {}) =>
  ({
    id: NEW,
    kind: "original",
    title: "Tide",
    stockCode: "LAX-ORI-1",
    zohoProductId: "zp",
    offer: { state: "private_sale", ref: { kind: "bid_lot", id: "lot-1" } },
    ...over,
  }) as ArtworkRegisterEntry;

type Setup = {
  deal?: Partial<PrivateSaleDealDetail>;
  artwork?: ArtworkRegisterEntry | null;
  offerError?: Error;
  withdrawError?: Error;
  writeKind?: "ok" | "conflict";
};

function setup(options: Setup = {}) {
  let deal = makeDeal({
    stage: "offer",
    artworkRegisterId: OLD,
    artworkUnlinkedReason: null,
    version: 3,
    ...options.deal,
  });
  const committed: {
    deal: PrivateSaleDealDetail;
    changes: PrivateSaleArtworkChange[];
    events: string[];
    holds: string[];
  } = {
    deal,
    changes: [],
    events: [],
    holds: [],
  };
  const run = vi.fn(async <T>(work: (tx: never) => Promise<T>): Promise<T> => {
    // A transaction: what it wrote is kept only if it finishes.
    const pending = {
      changes: [] as PrivateSaleArtworkChange[],
      events: [] as string[],
      holds: [] as string[],
      deal,
    };
    scope.pending = pending;
    const result = await work(undefined as never);
    deal = pending.deal;
    committed.deal = deal;
    committed.changes.push(...pending.changes);
    committed.events.push(...pending.events);
    committed.holds.push(...pending.holds);
    return result;
  });
  const scope: {
    pending: {
      changes: PrivateSaleArtworkChange[];
      events: string[];
      holds: string[];
      deal: PrivateSaleDealDetail;
    } | null;
  } = { pending: null };
  const pending = () => scope.pending as NonNullable<typeof scope.pending>;
  const setArtwork = vi.fn(
    async (_id: string, version: number, change: PrivateSaleArtworkChange) => {
      if (options.writeKind === "conflict" || version !== pending().deal.version) {
        return { kind: "conflict" } as const;
      }
      pending().changes.push(change);
      pending().deal = {
        ...pending().deal,
        artworkRegisterId: change.artworkRegisterId,
        artworkUnlinkedReason: change.unlinkedReason,
        version: version + 1,
      };
      return { kind: "ok", deal: pending().deal } as const;
    },
  );
  const offer = vi.fn(async (id: string) => {
    if (options.offerError) throw options.offerError;
    pending().holds.push(`offer:${id}`);
    return "moved" as const;
  });
  const withdraw = vi.fn(async (id: string) => {
    if (options.withdrawError) throw options.withdrawError;
    pending().holds.push(`withdraw:${id}`);
    return "moved" as const;
  });
  const publish = vi.fn(async (event: { eventType: string }) => {
    pending().events.push(event.eventType);
  });
  const recordOf = vi.fn(
    async (_v: unknown, d: PrivateSaleDealDetail) => ({ reference: d.reference }) as never,
  );
  const service = new DealArtworkService({
    deals: {
      findByReference: async (ref: string) => (ref === deal.reference ? deal : null),
    } as never,
    artworks: { findById: async () => (options.artwork === undefined ? entry() : options.artwork) },
    transactionRunner: { runInTransaction: run } as never,
    scopeForTx: () => ({
      deals: { setArtwork } as never,
      events: { publish } as never,
      register: { offer, withdraw, markSold: vi.fn() },
    }),
    lockLinks: {
      attach: async (items) =>
        items.map(({ lock }) => ({
          ...lock,
          link: lock.link ? { ...lock.link, href: "/admin/lots/lot-1" } : null,
        })),
    },
    records: { recordOf },
  });
  return {
    service,
    committed,
    setArtwork,
    offer,
    withdraw,
    publish,
    recordOf,
    current: () => deal,
  };
}

const CHANGE = { version: 3, artworkRegisterId: NEW, reason: "The buyer chose the earlier study." };

describe("DealArtworkService permissions and scope", () => {
  it("refuses a person who cannot manage deals, before reading anything", async () => {
    const { service, setArtwork } = setup();
    expect(await service.set(viewer(false), "PS-0001", CHANGE)).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(
      await service.remove(viewer(false), "PS-0001", {
        version: 3,
        notInRegister: { reason: "sellers_own_work" },
      }),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(setArtwork).not.toHaveBeenCalled();
  });

  it("says a deal outside the person's scope does not exist", async () => {
    const { service } = setup({ deal: { ownerUserId: "someone-else" } });
    const owned = viewer(true, { kind: "owned", userId: "u-staff" });
    expect(await service.set(owned, "PS-0001", CHANGE)).toEqual({
      ok: false,
      error: "deal_not_found",
    });
  });

  it("answers a deal that is not there as not found", async () => {
    const { service } = setup();
    expect(await service.set(viewer(), "PS-9999", CHANGE)).toEqual({
      ok: false,
      error: "deal_not_found",
    });
  });

  it("refuses a change made against an older version of the deal", async () => {
    const { service, setArtwork } = setup();
    expect(await service.set(viewer(), "PS-0001", { ...CHANGE, version: 2 })).toEqual({
      ok: false,
      error: "stale_version",
      currentVersion: 3,
    });
    expect(setArtwork).not.toHaveBeenCalled();
  });
});

describe("DealArtworkService stage rules", () => {
  it.each(["proposed", "offer"] as const)(
    "changes a held artwork while the deal is %s",
    async (stage) => {
      const { service } = setup({ deal: { stage } });
      expect((await service.set(viewer(), "PS-0001", CHANGE)).ok).toBe(true);
    },
  );

  it.each(["agreed", "cleared", "invoiced", "paid", "released", "settled", "cancelled"] as const)(
    "does not change or remove a held artwork once the deal is %s",
    async (stage) => {
      const { service, offer } = setup({ deal: { stage } });
      expect(await service.set(viewer(), "PS-0001", CHANGE)).toEqual({
        ok: false,
        error: "artwork_locked",
      });
      expect(
        await service.remove(viewer(), "PS-0001", {
          version: 3,
          notInRegister: { reason: "in_zoho_not_linked" },
        }),
      ).toEqual({ ok: false, error: "artwork_locked" });
      expect(offer).not.toHaveBeenCalled();
    },
  );

  it.each(["proposed", "offer", "agreed", "cleared", "invoiced", "paid", "released"] as const)(
    "links an artwork to a deal that has none while it is %s",
    async (stage) => {
      const { service, offer } = setup({ deal: { stage, artworkRegisterId: null } });
      expect(
        (await service.set(viewer(), "PS-0001", { version: 3, artworkRegisterId: NEW })).ok,
      ).toBe(true);
      expect(offer).toHaveBeenCalledWith(NEW, "deal-1", "staff:u-staff");
    },
  );

  it.each(["settled", "cancelled"] as const)("does not link once the deal is %s", async (stage) => {
    const { service } = setup({ deal: { stage, artworkRegisterId: null } });
    expect(await service.set(viewer(), "PS-0001", { version: 3, artworkRegisterId: NEW })).toEqual({
      ok: false,
      error: "artwork_locked",
    });
  });
});

describe("DealArtworkService input rules", () => {
  it.each([
    ["neither", {}],
    ["both", { artworkRegisterId: NEW, notInRegister: { reason: "sellers_own_work" as const } }],
  ])("needs the artwork or the reason, not %s", async (_label, body) => {
    const { service } = setup();
    expect(await service.set(viewer(), "PS-0001", { version: 3, ...body })).toEqual({
      ok: false,
      error: "artwork_choice_required",
    });
  });

  it("asks why when the artwork is changed", async () => {
    const { service, offer } = setup();
    expect(await service.set(viewer(), "PS-0001", { version: 3, artworkRegisterId: NEW })).toEqual({
      ok: false,
      error: "reason_required",
    });
    expect(offer).not.toHaveBeenCalled();
  });

  it("does not change an artwork to itself", async () => {
    const { service } = setup();
    expect(await service.set(viewer(), "PS-0001", { ...CHANGE, artworkRegisterId: OLD })).toEqual({
      ok: false,
      error: "artwork_unchanged",
    });
  });

  it("refuses an artwork the register does not have, and a print", async () => {
    expect(await setup({ artwork: null }).service.set(viewer(), "PS-0001", CHANGE)).toEqual({
      ok: false,
      error: "artwork_not_found",
    });
    expect(
      await setup({ artwork: entry({ kind: "print" }) }).service.set(viewer(), "PS-0001", CHANGE),
    ).toEqual({ ok: false, error: "artwork_not_original" });
  });
});

describe("DealArtworkService holding through the register's lock", () => {
  it("changes: holds the new artwork, releases the old one, writes history and audit, in one transaction", async () => {
    const { service, committed, offer, withdraw } = setup();
    const result = await service.set(viewer(), "PS-0001", CHANGE);
    expect(result.ok).toBe(true);
    expect(offer).toHaveBeenCalledWith(NEW, "deal-1", "staff:u-staff");
    expect(withdraw).toHaveBeenCalledWith(OLD, "deal-1", "staff:u-staff");
    expect(offer.mock.invocationCallOrder[0]).toBeLessThan(
      withdraw.mock.invocationCallOrder[0] as number,
    );
    expect(committed.changes).toEqual([
      {
        action: "changed",
        actorUserId: "u-staff",
        artworkRegisterId: NEW,
        unlinkedReason: null,
        reason: "The buyer chose the earlier study.",
      },
    ]);
    expect(committed.events).toEqual(["private_sale_deal.artwork_changed"]);
  });

  it("links: holds the artwork for the deal and releases nothing", async () => {
    const { service, committed, withdraw } = setup({ deal: { artworkRegisterId: null } });
    expect(
      (await service.set(viewer(), "PS-0001", { version: 3, artworkRegisterId: NEW })).ok,
    ).toBe(true);
    expect(withdraw).not.toHaveBeenCalled();
    expect(committed.changes[0]).toMatchObject({
      action: "linked",
      artworkRegisterId: NEW,
      reason: null,
    });
    expect(committed.events).toEqual(["private_sale_deal.artwork_linked"]);
  });

  it("removes: releases the artwork and records why it is no longer linked", async () => {
    const { service, committed, offer, withdraw } = setup();
    const result = await service.remove(viewer(), "PS-0001", {
      version: 3,
      notInRegister: { reason: "in_zoho_not_linked" },
      reason: "Wrong record picked.",
    });
    expect(result.ok).toBe(true);
    expect(offer).not.toHaveBeenCalled();
    expect(withdraw).toHaveBeenCalledWith(OLD, "deal-1", "staff:u-staff");
    expect(committed.changes[0]).toMatchObject({
      action: "removed",
      artworkRegisterId: null,
      unlinkedReason: "in_zoho_not_linked",
      reason: "Wrong record picked.",
    });
    expect(committed.events).toEqual(["private_sale_deal.artwork_removed"]);
  });

  it("records a reason on a deal with no artwork without touching the register", async () => {
    const { service, offer, withdraw, committed } = setup({ deal: { artworkRegisterId: null } });
    expect(
      (
        await service.set(viewer(), "PS-0001", {
          version: 3,
          notInRegister: { reason: "sellers_own_work" },
        })
      ).ok,
    ).toBe(true);
    expect(offer).not.toHaveBeenCalled();
    expect(withdraw).not.toHaveBeenCalled();
    expect(committed.changes[0]).toMatchObject({
      action: "linked",
      unlinkedReason: "sellers_own_work",
    });
  });

  it("refuses with the lock's own message and link, and changes nothing", async () => {
    const lock = lockMessage("in_bid_sale", { saleName: "Winter Modern", lotNumber: 14 });
    const { service, committed, current } = setup({ offerError: new DealArtworkRefused(lock) });
    const result = await service.set(viewer(), "PS-0001", CHANGE);
    expect(result).toMatchObject({
      ok: false,
      error: "artwork_unavailable",
      message: lock.message,
      lock: { reason: "in_bid_sale", link: { target: "bid_lot", href: "/admin/lots/lot-1" } },
    });
    // Neither the deal, the history nor the audit event was kept, and the old artwork is still held.
    expect(committed.changes).toEqual([]);
    expect(committed.events).toEqual([]);
    expect(committed.holds).toEqual([]);
    expect(current().artworkRegisterId).toBe(OLD);
  });

  it("keeps the old hold when releasing it fails after the new one was taken", async () => {
    const { service, committed } = setup({ withdrawError: new DealRegisterUnavailable("down") });
    expect(await service.set(viewer(), "PS-0001", CHANGE)).toEqual({
      ok: false,
      error: "artwork_register_busy",
      message: "down",
    });
    expect(committed.holds).toEqual([]);
    expect(committed.changes).toEqual([]);
  });

  it("answers stale when someone else changed the deal between reading it and writing", async () => {
    const { service, offer, committed } = setup({ writeKind: "conflict" });
    expect(await service.set(viewer(), "PS-0001", CHANGE)).toEqual({
      ok: false,
      error: "stale_version",
    });
    expect(offer).not.toHaveBeenCalled();
    expect(committed.events).toEqual([]);
  });

  it("rethrows what it does not understand", async () => {
    const { service } = setup({ offerError: new Error("disk on fire") });
    await expect(service.set(viewer(), "PS-0001", CHANGE)).rejects.toThrow("disk on fire");
  });
});
