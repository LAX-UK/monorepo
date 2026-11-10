import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { Lot, Sale } from "@auction/types";
import { SALE_TIME_ZONE_LOCKED_MESSAGE } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import type { SaleServiceDeps } from "./sale-types.js";
import { type UpdateSaleBody, updateDraftSale } from "./sale-update-draft.js";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    title: "Evening",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "draft",
    startTime: new Date("2026-12-01T10:00:00Z"),
    endTime: new Date("2026-12-08T10:00:00Z"),
    previewStartTime: null,
    timeZone: "Europe/London",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function lotAt(n: number, start: Date, end: Date): Lot {
  return {
    id: `lot-${n}`,
    saleId: "sale-1",
    title: `Lot ${n}`,
    status: "draft",
    startTime: start,
    endTime: end,
  } as Lot;
}

function setup(existing: Sale, lots: Lot[] = []) {
  const update = vi.fn(async (_id: string, patch: Partial<Sale>) => ({ ...existing, ...patch }));
  const lotUpdate = vi.fn(async () => undefined);
  const deps = {
    saleRepo: {
      findById: vi.fn().mockResolvedValue(existing),
      update,
    } as unknown as ISaleRepository,
    lotRepo: {
      findBySaleId: vi.fn().mockResolvedValue(lots),
      update: lotUpdate,
    } as unknown as ILotRepository,
    resolvePlatformCatalogLegalEntityId: async () => "le-1",
  } as unknown as SaleServiceDeps;
  const run = (patch: Record<string, unknown>) =>
    updateDraftSale(deps, "staff", existing.id, patch as UpdateSaleBody, ["administrator"]);
  return { run, update, lotUpdate, deps };
}

describe("a sale's time zone on update", () => {
  it("changes while the sale is a draft", async () => {
    const { run, update } = setup(sale());
    const result = await run({ timeZone: "Europe/Paris" });
    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith(
      "sale-1",
      expect.objectContaining({ timeZone: "Europe/Paris" }),
    );
  });

  it.each(["scheduled", "active", "ended"] as const)(
    "is locked once the sale is %s, with the reason",
    async (status) => {
      const { run, update } = setup(sale({ status }));
      const result = await run({ timeZone: "Europe/Paris", title: "Renamed" });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe(SALE_TIME_ZONE_LOCKED_MESSAGE);
        expect(result.error.status).toBe(422);
      }
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("lets a published sale be saved with its zone unchanged", async () => {
    const { run, update } = setup(sale({ status: "scheduled" }));
    const result = await run({ timeZone: "Europe/London", title: "Renamed" });
    expect(result.isOk()).toBe(true);
    expect(update).toHaveBeenCalledWith("sale-1", expect.objectContaining({ title: "Renamed" }));
  });
});

describe("a draft sale that was announced and unpublished", () => {
  it("keeps its zone locked", async () => {
    const { run, update } = setup(sale({ firstPublishedAt: new Date("2026-10-01T00:00:00Z") }));
    const result = await run({ timeZone: "Europe/Paris" });
    expect(result.isErr()).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("saves with its zone unchanged, without sending the zone to the guarded update", async () => {
    const { run, update } = setup(sale({ firstPublishedAt: new Date("2026-10-01T00:00:00Z") }));
    const result = await run({ timeZone: "Europe/London", title: "Renamed" });
    expect(result.isOk()).toBe(true);
    expect(update.mock.calls[0]?.[1]).not.toHaveProperty("timeZone");
  });
});

describe("re-zoning a draft sale moves its times and its lots' times together", () => {
  const start = new Date("2030-11-12T18:00:00Z");
  const end = new Date("2030-11-26T18:00:00Z");

  it("keeps 200 staggered lots' typed times and their stagger, London to New York", async () => {
    const lots = Array.from({ length: 200 }, (_, n) => {
      const open = new Date(start.getTime() + n * 60_000);
      return lotAt(n, open, new Date(open.getTime() + 7 * 24 * 60 * 60_000 - n * 60_000));
    });
    const { run, update, lotUpdate } = setup(
      sale({ deliveryMode: "online", startTime: start, endTime: end }),
      lots,
    );
    const result = await run({ timeZone: "America/New_York" });
    expect(result.isOk()).toBe(true);
    // The sale keeps 18:00 on the wall clock: five hours later in UTC.
    expect(update.mock.calls[0]?.[1]).toMatchObject({
      timeZone: "America/New_York",
      startTime: new Date("2030-11-12T23:00:00Z"),
      endTime: new Date("2030-11-26T23:00:00Z"),
    });
    expect(lotUpdate).toHaveBeenCalledTimes(200);
    lotUpdate.mock.calls.forEach((call, n) => {
      const [, times] = call as unknown as [string, { startTime: Date; endTime: Date }];
      expect(times.startTime.getTime()).toBe(
        (lots[n] as Lot).startTime.getTime() + 5 * 60 * 60_000,
      );
      expect(times.endTime.getTime()).toBe((lots[n] as Lot).endTime.getTime() + 5 * 60 * 60_000);
    });
  });

  it("refuses a move that would push a lot outside the new window", async () => {
    const lot = lotAt(1, start, new Date(end.getTime() + 1));
    const { run, update } = setup(
      sale({ deliveryMode: "online", startTime: start, endTime: end }),
      [lot],
    );
    const result = await run({
      timeZone: "America/New_York",
      endTime: new Date(end.getTime() - 1),
    });
    expect(result.isErr()).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("a draft sale already sent to ATG", () => {
  function onAtg(remote: "pending" | "created" | "published" | null) {
    const ready = setup(sale());
    const ownership = remote && {
      saleStatus: "draft" as const,
      atgRemoteStatus: remote,
      atgLinked: true,
      atgSoldLotCount: 0,
      sellingPlatform: remote === "published" ? ("atg" as const) : ("free" as const),
      atgDistribution: "private_test" as const,
    };
    const getSaleOwnership = vi.fn().mockResolvedValue(ownership);
    Object.assign(ready.deps, { saleChannelReader: { getSaleOwnership } });
    return { ...ready, getSaleOwnership };
  }

  it.each(["created", "published"] as const)(
    "keeps its zone while ATG holds the auction (%s)",
    async (remote) => {
      const { run, update } = onAtg(remote);
      const result = await run({ timeZone: "Europe/Paris" });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatchObject({ code: "sale_on_atg" });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("can still be re-zoned before ATG has the auction", async () => {
    const { run } = onAtg("pending");
    const result = await run({ timeZone: "Europe/Paris" });
    expect(result.isOk()).toBe(true);
  });

  it("does not ask ATG when the zone is unchanged", async () => {
    const { run, getSaleOwnership } = onAtg("published");
    const result = await run({ timeZone: "Europe/London", title: "Renamed" });
    expect(result.isOk()).toBe(true);
    expect(getSaleOwnership).not.toHaveBeenCalled();
  });
});
