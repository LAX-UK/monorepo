import { SALE_TIME_ZONE_INVALID, SALE_TIME_ZONE_NOT_A_PLACE } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { emptyAdminSaleFormValues, saleToAdminSaleFormValues } from "./admin-sale-defaults";
import {
  type AdminSaleFormValues,
  adminSaleFormValuesSchema,
  safeParseCreateSaleFromForm,
  safeParseUpdateSaleFromForm,
} from "./admin-sale-form";

function values(overrides: Partial<AdminSaleFormValues> = {}): AdminSaleFormValues {
  return {
    ...emptyAdminSaleFormValues(),
    title: "Autumn sale",
    deliveryMode: "online",
    startTime: "2030-11-12T18:00",
    endTime: "2030-11-19T18:00",
    ...overrides,
  };
}

function issueFor(v: AdminSaleFormValues, path: string) {
  const result = adminSaleFormValuesSchema.safeParse(v);
  return result.success ? undefined : result.error.issues.find((i) => i.path[0] === path)?.message;
}

describe("the sale form's time zone", () => {
  it("starts on London unless another default zone is given", () => {
    expect(emptyAdminSaleFormValues().timeZone).toBe("Europe/London");
    expect(emptyAdminSaleFormValues("Europe/Paris").timeZone).toBe("Europe/Paris");
  });

  it("shows a stored sale's times as wall-clock times in its own zone", () => {
    const form = saleToAdminSaleFormValues({
      ...({} as never),
      title: "Paris",
      description: null,
      coverImages: [],
      categoryId: null,
      isTest: false,
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
      venueId: null,
      timeZone: "Europe/Paris",
      startTime: new Date("2030-11-12T17:00:00Z"),
      endTime: new Date("2030-11-19T17:00:00Z"),
      previewStartTime: null,
      buyerPremiumRate: "0.25",
      buyerPremiumTiers: null,
      terms: null,
    });
    expect(form.timeZone).toBe("Europe/Paris");
    expect(form.startTime).toBe("2030-11-12T18:00");
  });

  it("rejects UTC with the place message and an unknown name with the list message", () => {
    expect(issueFor(values({ timeZone: "UTC" }), "timeZone")).toBe(SALE_TIME_ZONE_NOT_A_PLACE);
    expect(issueFor(values({ timeZone: "Etc/GMT+3" }), "timeZone")).toBe(
      SALE_TIME_ZONE_NOT_A_PLACE,
    );
    expect(issueFor(values({ timeZone: "Nowhere/Land" }), "timeZone")).toBe(SALE_TIME_ZONE_INVALID);
    expect(issueFor(values({ timeZone: "" }), "timeZone")).toBe("Choose a time zone");
    expect(issueFor(values({ timeZone: "Asia/Dubai" }), "timeZone")).toBeUndefined();
  });

  it("reads the typed times in the chosen zone, keeping the wall-clock time", () => {
    const london = safeParseCreateSaleFromForm(values({ timeZone: "Europe/London" }));
    const paris = safeParseCreateSaleFromForm(values({ timeZone: "Europe/Paris" }));
    expect(london.success && london.data.startTime.toISOString()).toBe("2030-11-12T18:00:00.000Z");
    expect(paris.success && paris.data.startTime.toISOString()).toBe("2030-11-12T17:00:00.000Z");
    expect(paris.success && paris.data.timeZone).toBe("Europe/Paris");
  });

  it("sends the zone with a draft update", () => {
    const parsed = safeParseUpdateSaleFromForm(values({ timeZone: "Asia/Dubai" }));
    expect(parsed.success && parsed.data.timeZone).toBe("Asia/Dubai");
    expect(parsed.success && parsed.data.startTime?.toISOString()).toBe("2030-11-12T14:00:00.000Z");
  });

  it("says when a typed time does not exist in the zone", () => {
    expect(issueFor(values({ startTime: "2031-03-30T01:30" }), "startTime")).toBe(
      "That time doesn't exist on 30 Mar because the clocks go forward. Choose 02:00 or later.",
    );
    // The same wall time exists in Dubai, which has no clock change.
    expect(
      issueFor(values({ startTime: "2031-03-30T01:30", timeZone: "Asia/Dubai" }), "startTime"),
    ).toBeUndefined();
  });
});
