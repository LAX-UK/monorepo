import type { LotCatalogueUpdateRequest } from "@auction/artwork-register-contracts";
import type { AuctionOfferLotCatalogue } from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { LotError } from "../../lib/errors.js";
import { LotCatalogueService } from "./lot-catalogue.service.js";

const registerId = "11111111-1111-4111-8111-111111111111";
const request: LotCatalogueUpdateRequest = {
  actor: "staff:abc",
  content: { title: "Green", medium: null, dimensions: "10 x 10 cm", imageUrls: [] },
};

function lotIn(over: Partial<AuctionOfferLotCatalogue> = {}): AuctionOfferLotCatalogue {
  return {
    lotId: "22222222-2222-4222-8222-222222222222",
    status: "draft",
    saleStatus: "draft",
    title: "Blue",
    medium: "Oil",
    dimensions: null,
    images: ["https://img/a.jpg"],
    ...over,
  };
}

function build(lot: AuctionOfferLotCatalogue | null) {
  const update = vi.fn().mockResolvedValue(ok({}));
  const service = new LotCatalogueService({
    offers: { findLotCatalogueForRegister: vi.fn().mockResolvedValue(lot) } as never,
    lots: { update },
  });
  return { service, update };
}

describe("LotCatalogueService", () => {
  it("reports the lot's catalogue facts and how far it has gone", async () => {
    const { service } = build(lotIn({ status: "scheduled", saleStatus: "scheduled" }));
    expect(await service.describe(registerId)).toMatchObject({
      status: "scheduled",
      saleStatus: "scheduled",
      title: "Blue",
      imageUrls: ["https://img/a.jpg"],
    });
  });

  it("answers nothing when no lot holds the artwork", async () => {
    expect(await build(null).service.describe(registerId)).toBeNull();
  });

  it("gives a draft lot in a sale that has not started Zoho's details", async () => {
    const { service, update } = build(lotIn());
    const outcome = await service.updateDraft(registerId, request);
    expect(outcome).toEqual({ ok: true, data: { lotId: "22222222-2222-4222-8222-222222222222" } });
    expect(update).toHaveBeenCalledWith("admin", "22222222-2222-4222-8222-222222222222", {
      title: "Green",
      medium: "",
      dimensions: "10 x 10 cm",
      images: [],
    });
  });

  it.each([
    ["scheduled lot", { status: "scheduled" as const }],
    ["live lot", { status: "active" as const, saleStatus: "active" }],
    ["draft lot in a sale that has started", { saleStatus: "active" }],
    ["draft lot in an upcoming scheduled sale", { saleStatus: "scheduled" }],
  ])("never changes a %s", async (_name, over) => {
    const { service, update } = build(lotIn(over));
    const outcome = await service.updateDraft(registerId, request);
    expect(outcome).toMatchObject({ ok: false, status: 409, refusal: { error: "lot_not_draft" } });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when there is no lot, and passes the lot service's refusal on", async () => {
    expect(await build(null).service.updateDraft(registerId, request)).toMatchObject({
      ok: false,
      status: 404,
    });
    const { service, update } = build(lotIn());
    update.mockResolvedValueOnce(err(new LotError("This lot cannot be edited")));
    expect(await service.updateDraft(registerId, request)).toMatchObject({
      ok: false,
      refusal: { message: "This lot cannot be edited" },
    });
  });
});
