import { describe, expect, it } from "vitest";
import {
  type AdminLotFormValues,
  adminLotFormValuesSchema,
  buildAdminLotFormSchema,
  formValuesToImageAltsPatch,
  safeParseCreateLotFromForm,
  safeParseUpdateLotFromForm,
} from "./admin-lot-form";

const saleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const base: AdminLotFormValues = {
  title: "Lot",
  description: "",
  medium: "",
  dimensions: "",
  sellerLegalEntityId: "7f3ed11b-257a-4fc1-a916-4723c8417c5e",
  categoryIds: ["7f3ed11b-257a-4fc1-a916-4723c8417c5e"],
  saleId,
  auctionType: "english",
  startingPrice: "1.00",
  reservePrice: "",
  buyNowPrice: "",
  buyerPremiumRate: "",
  minBidIncrement: "",
  dutchDecrementAmount: "",
  dutchDecrementIntervalMs: "60000",
  images: [],
  imageAlts: [],
  startTime: "2026-05-05T10:00",
  endTime: "2026-05-06T10:00",
};

describe("adminLotFormValuesSchema auction type rules", () => {
  it("passes english without dutch fields", () => {
    const parsed = adminLotFormValuesSchema.safeParse({
      ...base,
      auctionType: "english",
      dutchDecrementAmount: "",
      dutchDecrementIntervalMs: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("fails dutch when decrement fields are missing", () => {
    const parsed = adminLotFormValuesSchema.safeParse({
      ...base,
      auctionType: "dutch",
      dutchDecrementAmount: "",
      dutchDecrementIntervalMs: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("dutchDecrementAmount");
      expect(paths).toContain("dutchDecrementIntervalMs");
    }
  });

  it("fails buy_it_now when buy now price is missing", () => {
    const parsed = adminLotFormValuesSchema.safeParse({
      ...base,
      auctionType: "buy_it_now",
      buyNowPrice: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("buyNowPrice"))).toBe(true);
    }
  });

  it("fails buy_it_now when buy now is below list price", () => {
    const parsed = adminLotFormValuesSchema.safeParse({
      ...base,
      auctionType: "buy_it_now",
      startingPrice: "100.00",
      buyNowPrice: "50.00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("buyNowPrice"))).toBe(true);
    }
  });
});

describe("safeParseCreateLotFromForm", () => {
  it("requires a sale assignment", () => {
    const parsed = safeParseCreateLotFromForm({ ...base, saleId: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes("saleId"))).toBe(true);
    }
  });

  it("accepts a valid sale id", () => {
    const parsed = safeParseCreateLotFromForm(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.saleId).toBe(saleId);
    }
  });
});

describe("safeParseUpdateLotFromForm", () => {
  it("includes saleId in the update payload", () => {
    const nextSaleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const parsed = safeParseUpdateLotFromForm({ ...base, saleId: nextSaleId });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.saleId).toBe(nextSaleId);
    }
  });
});

describe("buildAdminLotFormSchema", () => {
  it("rejects online lot schedule outside the sale window", () => {
    const saleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const salesById = new Map([
      [
        saleId,
        {
          id: saleId,
          deliveryMode: "online" as const,
          startTime: new Date("2026-06-01T10:00:00Z"),
          endTime: new Date("2026-06-07T18:00:00Z"),
        },
      ],
    ]);
    const schema = buildAdminLotFormSchema(salesById);
    const parsed = schema.safeParse({
      ...base,
      saleId,
      startTime: "2026-05-31T10:00",
      endTime: "2026-06-03T18:00",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("formValuesToImageAltsPatch", () => {
  it("trims alts and preserves image order", () => {
    expect(
      formValuesToImageAltsPatch({
        ...base,
        images: ["lot/a.jpg", "lot/b.jpg"],
        imageAlts: [" Front view ", "Back view"],
      }),
    ).toEqual({ imageAlts: ["Front view", "Back view"] });
  });

  it("returns null when all alts are blank", () => {
    expect(
      formValuesToImageAltsPatch({
        ...base,
        images: ["lot/a.jpg"],
        imageAlts: ["   "],
      }),
    ).toEqual({ imageAlts: null });
  });
});
