import { type ArtworkRegisterEntry, lockMessage } from "@auction/artwork-register-contracts";
import type { PrivateSaleDealDetail } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { makeDeal } from "./deal-fixtures.test-util.js";
import { DealMarkSoldService } from "./deal-mark-sold.service.js";
import {
  DealArtworkRefused,
  type DealRegisterStatus,
  DealRegisterUnavailable,
} from "./deal-register-lock.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";

const ART = "00000000-0000-4000-8000-000000000001";

const viewer = (
  manage = true,
  scope: DealStaffViewer["scope"] = { kind: "all" },
): DealStaffViewer => ({
  userId: "u-staff",
  abilities: { manage, finance: false, release: false },
  checks: true,
  scope,
});

const elsewhere = (state: "bid_sale" | "sold" = "bid_sale") =>
  ({
    id: ART,
    kind: "original",
    zohoProductId: "zp",
    offer: {
      state,
      ref: state === "sold" ? { kind: "gallery_sale", id: "zp" } : { kind: "bid_lot", id: "lot-1" },
    },
  }) as ArtworkRegisterEntry;

type Setup = {
  deal?: Partial<PrivateSaleDealDetail>;
  status?: DealRegisterStatus;
  error?: Error;
  artwork?: ArtworkRegisterEntry | null;
};

function setup(options: Setup = {}) {
  const deal = makeDeal({ stage: "settled", artworkRegisterId: ART, ...options.deal });
  const published: { eventType: string; payload: unknown; actorUserId: string | null }[] = [];
  const markSold = vi.fn(async () => {
    if (options.error) throw options.error;
    return options.status ?? "moved";
  });
  const record = { reference: deal.reference };
  const service = new DealMarkSoldService({
    deals: { findByReference: async () => deal } as never,
    artworks: { findById: async () => (options.artwork === undefined ? null : options.artwork) },
    transactionRunner: {
      runInTransaction: async <T>(work: (tx: never) => Promise<T>) => work({} as never),
    } as never,
    scopeForTx: () => ({
      events: {
        publish: async (event: (typeof published)[number]) => {
          published.push(event);
        },
        withTx: () => {
          throw new Error("unused");
        },
      } as never,
      register: { offer: vi.fn(), withdraw: vi.fn(), markSold },
    }),
    lockLinks: {
      attach: async (items: readonly { lock: ReturnType<typeof lockMessage> }[]) =>
        items.map(({ lock }) => ({
          ...lock,
          link: lock.link ? { ...lock.link, href: "/admin/lots/lot-1" } : null,
        })),
    } as never,
    records: { recordOf: async () => record as never },
  });
  return { service, markSold, published };
}

describe("DealMarkSoldService", () => {
  it("records the artwork sold through the deal and audits the attempt", async () => {
    const { service, markSold, published } = setup({ status: "moved" });
    const result = await service.markSold(viewer(), "PS-0001");
    expect(result).toEqual({ ok: true, record: { reference: "PS-0001" } });
    expect(markSold).toHaveBeenCalledWith(ART, expect.any(String), "staff:u-staff");
    expect(published).toEqual([
      expect.objectContaining({
        eventType: "private_sale_deal.artwork_mark_sold_retried",
        actorUserId: "u-staff",
        payload: expect.objectContaining({ outcome: "marked" }),
      }),
    ]);
  });

  it("answers as done when the register already shows it sold through the deal", async () => {
    const { service, published } = setup({ status: "unchanged" });
    const first = await service.markSold(viewer(), "PS-0001");
    const second = await service.markSold(viewer(), "PS-0001");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(published.map((e) => (e.payload as { outcome: string }).outcome)).toEqual([
      "already_marked",
      "already_marked",
    ]);
  });

  it("refuses with the register's own words when it shows the artwork somewhere else", async () => {
    const { service, published } = setup({ status: "skipped", artwork: elsewhere() });
    const result = await service.markSold(viewer(), "PS-0001");
    expect(result).toMatchObject({
      ok: false,
      error: "artwork_unavailable",
      message: lockMessage("in_bid_sale").message,
      lock: { reason: "in_bid_sale", link: { href: "/admin/lots/lot-1" } },
    });
    expect(published.map((e) => (e.payload as { outcome: string }).outcome)).toEqual(["skipped"]);
  });

  it("treats a refusal from the lock as the artwork being shown elsewhere", async () => {
    const { service } = setup({
      error: new DealArtworkRefused(lockMessage("sold_in_gallery")),
      artwork: elsewhere("sold"),
    });
    const result = await service.markSold(viewer(), "PS-0001");
    expect(result).toMatchObject({ ok: false, error: "artwork_unavailable" });
  });

  it("says so, and audits it, when the register could not record it", async () => {
    const { service, published } = setup({ error: new DealRegisterUnavailable("busy") });
    const result = await service.markSold(viewer(), "PS-0001");
    expect(result).toEqual({ ok: false, error: "artwork_register_busy", message: "busy" });
    expect(published.map((e) => (e.payload as { outcome: string }).outcome)).toEqual(["failed"]);
  });

  it("is only for people who run deals", async () => {
    const { service, markSold } = setup();
    expect(await service.markSold(viewer(false), "PS-0001")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(markSold).not.toHaveBeenCalled();
  });

  it("does not show a deal outside the person's scope", async () => {
    const { service } = setup({ deal: { ownerUserId: "someone-else" } });
    expect(
      await service.markSold(viewer(true, { kind: "owned", userId: "u-staff" }), "PS-0001"),
    ).toEqual({ ok: false, error: "deal_not_found" });
  });

  it("applies only to a settled deal with a linked artwork", async () => {
    for (const deal of [{ stage: "paid" as const }, { artworkRegisterId: null }]) {
      const { service, markSold } = setup({ deal });
      expect(await service.markSold(viewer(), "PS-0001")).toEqual({
        ok: false,
        error: "not_settled",
      });
      expect(markSold).not.toHaveBeenCalled();
    }
  });
});
