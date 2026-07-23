import { describe, expect, it } from "vitest";
import { DELIVERY_MODE_REGISTRY, deliveryModeShortLabel } from "./delivery-mode-registry";
import { resolveDeliveryModePresentation } from "./resolve-delivery-mode";

describe("delivery-mode registry", () => {
  it("maps all delivery modes to staff labels and tag keys", () => {
    expect(DELIVERY_MODE_REGISTRY.online).toEqual({ label: "Online", mode: "online" });
    expect(DELIVERY_MODE_REGISTRY.onsite).toEqual({ label: "Onsite", mode: "onsite" });
    expect(DELIVERY_MODE_REGISTRY.hybrid).toEqual({ label: "Hybrid", mode: "hybrid" });
  });

  it("deliveryModeShortLabel delegates to registry", () => {
    expect(deliveryModeShortLabel("online")).toBe("Online");
    expect(deliveryModeShortLabel("onsite")).toBe("Onsite");
    expect(deliveryModeShortLabel("hybrid")).toBe("Hybrid");
  });

  it("resolveDeliveryModePresentation returns registry entry", () => {
    expect(resolveDeliveryModePresentation("hybrid")).toEqual({
      label: "Hybrid",
      mode: "hybrid",
    });
  });
});
