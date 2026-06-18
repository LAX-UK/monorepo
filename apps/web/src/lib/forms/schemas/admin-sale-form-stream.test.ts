import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import { safeParseUpdatePublishedSaleFromForm } from "@/lib/forms/schemas/admin-sale-form";
import { describe, expect, it } from "vitest";

describe("safeParseUpdatePublishedSaleFromForm", () => {
  it("includes streamUrl for hybrid saleroom sales", () => {
    const values = {
      ...emptyAdminSaleFormValues(),
      title: "Evening sale",
      deliveryMode: "hybrid" as const,
      streamUrl: "https://vimeo.com/event/6005027/embed/53b2f6d9ec",
    };
    const parsed = safeParseUpdatePublishedSaleFromForm(values);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.streamUrl).toBe("https://vimeo.com/event/6005027/embed/53b2f6d9ec");
  });

  it("clears streamUrl when empty on onsite sale", () => {
    const values = {
      ...emptyAdminSaleFormValues(),
      title: "Evening sale",
      deliveryMode: "onsite" as const,
      streamUrl: "",
    };
    const parsed = safeParseUpdatePublishedSaleFromForm(values);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.streamUrl).toBeNull();
  });

  it("omits streamUrl for online sales", () => {
    const values = {
      ...emptyAdminSaleFormValues(),
      title: "Online sale",
      deliveryMode: "online" as const,
      streamUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    };
    const parsed = safeParseUpdatePublishedSaleFromForm(values);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.streamUrl).toBeUndefined();
  });
});
