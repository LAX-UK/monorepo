import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
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

function setup(existing: Sale) {
  const update = vi.fn(async (_id: string, patch: Partial<Sale>) => ({ ...existing, ...patch }));
  const deps = {
    saleRepo: {
      findById: vi.fn().mockResolvedValue(existing),
      update,
    } as unknown as ISaleRepository,
    lotRepo: { findBySaleId: vi.fn().mockResolvedValue([]) } as unknown as ILotRepository,
    resolvePlatformCatalogLegalEntityId: async () => "le-1",
  } as unknown as SaleServiceDeps;
  const run = (patch: Record<string, unknown>) =>
    updateDraftSale(deps, "staff", existing.id, patch as UpdateSaleBody, ["administrator"]);
  return { run, update };
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
