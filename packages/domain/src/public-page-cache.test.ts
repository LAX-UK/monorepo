import { describe, expect, it } from "vitest";
import {
  PUBLIC_PAGE_EVENT_TYPES,
  isPublicItemCacheTag,
  publicPageLotEventNeedsSaleLookup,
  publicPageTagsForDomainEvent,
  publicPageTagsForLot,
} from "./public-page-cache.js";

const LOT = "0b8f0c1e-7c39-4a1c-9d1f-1f0f6a2b3c4d";
const SALE = "11111111-1111-4111-8111-111111111111";
const OTHER_SALE = "22222222-2222-4222-8222-222222222222";

describe("public page cache tags", () => {
  it("drops the lot, its sale and the lot lists for a lot change", () => {
    expect(publicPageTagsForLot({ id: LOT, saleId: SALE }).sort()).toEqual(
      ["catalogue-lots", `public-lot:${LOT}`, `public-sale:${SALE}`].sort(),
    );
  });

  it.each([
    "lot.published",
    "lot.unpublished",
    "lot.activated",
    "lot.ended",
    "lot.cancelled",
    "lot.voided",
  ])("maps %s to the lot and its sale", (eventType) => {
    const tags = publicPageTagsForDomainEvent({
      eventType,
      aggregateId: LOT,
      payload: { saleId: SALE },
    });
    expect(tags).toContain(`public-lot:${LOT}`);
    expect(tags).toContain(`public-sale:${SALE}`);
  });

  it("uses the looked-up sale when a lot event names none (a withdrawal)", () => {
    const event = {
      eventType: "lot.cancelled",
      aggregateId: LOT,
      payload: { reason: "withdrawal" },
    };
    expect(publicPageLotEventNeedsSaleLookup(event)).toBe(true);
    expect(publicPageTagsForDomainEvent(event, { lotSaleId: SALE })).toContain(
      `public-sale:${SALE}`,
    );
  });

  it("drops both sales when a lot moves between them", () => {
    const tags = publicPageTagsForDomainEvent({
      eventType: "lot.attached_to_sale",
      aggregateId: LOT,
      payload: { saleId: SALE, fromSaleId: OTHER_SALE, lotNumber: 1, via: "patch" },
    });
    expect(tags).toEqual(
      expect.arrayContaining([`public-sale:${SALE}`, `public-sale:${OTHER_SALE}`]),
    );
  });

  it.each([
    "sale.published",
    "sale.unpublished",
    "sale.cancelled",
    "sale.rescheduled",
    "sale.ended",
  ])("maps %s to the sale page and the lists", (eventType) => {
    expect(publicPageTagsForDomainEvent({ eventType, aggregateId: SALE })).toEqual([
      `public-sale:${SALE}`,
      "catalogue-sales",
      "catalogue-lots",
    ]);
  });

  it("ignores private events", () => {
    expect(
      publicPageTagsForDomainEvent({ eventType: "lot.seller_consent_given", aggregateId: LOT }),
    ).toEqual([]);
    expect(PUBLIC_PAGE_EVENT_TYPES).not.toContain("payment.captured");
  });

  it("produces only tags the web revalidate route accepts", () => {
    expect(isPublicItemCacheTag(`public-lot:${LOT}`)).toBe(true);
    expect(isPublicItemCacheTag("public-lot:../../x")).toBe(false);
  });
});

describe("event catalog agreement", () => {
  it("names the same events as the web_public_cache consumer in the catalog", async () => {
    const { WEB_PUBLIC_CACHE_EVENT_TYPES, listDomainEventTypesForConsumer } = await import(
      "@auction/types"
    );
    expect([...PUBLIC_PAGE_EVENT_TYPES].sort()).toEqual([...WEB_PUBLIC_CACHE_EVENT_TYPES].sort());
    expect([...listDomainEventTypesForConsumer("web_public_cache")].sort()).toEqual(
      [...PUBLIC_PAGE_EVENT_TYPES].sort(),
    );
  });
});
