import {
  createSaleSchema,
  getSaleModeCapabilities,
  saleModeAllowsBidding,
  saleModeAllowsLocation,
  saleModeAllowsStreamUrl,
  saleModeInheritsLotTiming,
  updateSaleSchema,
} from "@auction/validators";
import { describe, expect, it } from "vitest";

const baseInput = {
  title: "Spring Auction",
  startTime: new Date("2030-01-01T10:00:00.000Z"),
  endTime: new Date("2030-01-02T10:00:00.000Z"),
};

describe("sale-mode-policy", () => {
  it("describes online as biddable, no stream/location, per-lot timing", () => {
    const caps = getSaleModeCapabilities("online");
    expect(caps.allowsBidding).toBe(true);
    expect(caps.allowsStreamUrl).toBe(false);
    expect(caps.allowsLocation).toBe(false);
    expect(caps.inheritsLotTiming).toBe(false);

    expect(saleModeAllowsBidding("online")).toBe(true);
    expect(saleModeAllowsStreamUrl("online")).toBe(false);
    expect(saleModeAllowsLocation("online")).toBe(false);
    expect(saleModeInheritsLotTiming("online")).toBe(false);
  });

  it("describes onsite as read-only with stream + location and inherited timing", () => {
    const caps = getSaleModeCapabilities("onsite");
    expect(caps.allowsBidding).toBe(false);
    expect(caps.allowsStreamUrl).toBe(true);
    expect(caps.allowsLocation).toBe(true);
    expect(caps.inheritsLotTiming).toBe(true);

    expect(saleModeAllowsBidding("onsite")).toBe(false);
    expect(saleModeAllowsStreamUrl("onsite")).toBe(true);
    expect(saleModeAllowsLocation("onsite")).toBe(true);
    expect(saleModeInheritsLotTiming("onsite")).toBe(true);
  });
});

describe("createSaleSchema", () => {
  it("accepts an onsite sale with stream URL and location fields", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "onsite",
      streamUrl: "https://www.youtube.com/watch?v=abc12345678",
      locationName: "Main Hall",
      locationAddress: "1 Auction Way",
      locationMapUrl: "https://maps.example.com/main-hall",
    });
    expect(result.success).toBe(true);
  });

  it("rejects stream URL on online sales", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "online",
      streamUrl: "https://www.youtube.com/watch?v=abc12345678",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Stream URL is only allowed for onsite auctions");
    }
  });

  it("rejects location fields on online sales", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "online",
      locationName: "Main Hall",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("locationName");
    }
  });

  it("rejects each structured location field on online sales", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "online",
      locationAddressLine1: "1 Bond St",
      locationCity: "London",
      locationCounty: "Greater London",
      locationPostcode: "SW1Y 6QU",
      locationCountry: "United Kingdom",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toEqual(
        expect.arrayContaining([
          "locationAddressLine1",
          "locationCity",
          "locationCounty",
          "locationPostcode",
          "locationCountry",
        ]),
      );
    }
  });

  it("normalizes UK postcodes and accepts them on onsite sales", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "onsite",
      locationAddressLine1: "34 New Bond Street",
      locationCity: "London",
      locationPostcode: "sw1y6qu",
      locationCountry: "United Kingdom",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locationPostcode).toBe("SW1Y 6QU");
    }
  });

  it("rejects an obviously invalid UK postcode", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "onsite",
      locationPostcode: "not-a-postcode",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("locationPostcode");
    }
  });

  it("treats hybrid as not a member of saleDeliveryModes", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "hybrid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects venueId on online sales", () => {
    const result = createSaleSchema.safeParse({
      ...baseInput,
      deliveryMode: "online",
      venueId: "30000000-0000-4000-9000-000000000001",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("venueId");
    }
  });
});

describe("updateSaleSchema", () => {
  it("allows clearing the stream URL with empty string", () => {
    const result = updateSaleSchema.safeParse({
      streamUrl: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.streamUrl).toBeNull();
    }
  });

  it("rejects stream URL when explicitly switching to online", () => {
    const result = updateSaleSchema.safeParse({
      deliveryMode: "online",
      streamUrl: "https://www.youtube.com/watch?v=abc12345678",
    });
    expect(result.success).toBe(false);
  });
});
