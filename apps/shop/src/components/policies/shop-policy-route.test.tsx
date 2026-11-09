/** @vitest-environment jsdom */
import { DEFAULT_DELIVERY_REGIONS } from "@auction/shop-domain";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShopPolicyRoute } from "./shop-policy-route";

// A plain function, not a spy: a spy's record of a rejected promise would itself go unhandled.
const regions = vi.hoisted(() => ({
  calls: 0,
  read: (async () => ({})) as () => Promise<unknown>,
}));
vi.mock("@/lib/shop-api.server", () => ({
  fetchPublicDeliveryRegions: () => {
    regions.calls += 1;
    return regions.read();
  },
}));
vi.mock("@/lib/policies/shop-policy-publication.server", () => ({
  loadShopPolicyVisibility: () => "published",
  loadLinkableShopPolicies: () => ["delivery", "terms", "returns", "privacy", "cookies"],
}));
vi.mock("@/lib/ecosystem/product-directory.server", () => ({
  loadShopArtBaseUrl: () => "https://lax.art",
}));
vi.mock("@/lib/lax-account-url", () => ({ laxAccountUrl: () => "https://account.lax.art" }));

const apiRegions = {
  regions: DEFAULT_DELIVERY_REGIONS.map((region) => ({ ...region, countries: [] })),
  notDeliveredTo: [],
};

async function renderRoute(slug: "delivery" | "returns") {
  return render(await ShopPolicyRoute({ slug }));
}

describe("ShopPolicyRoute", () => {
  beforeEach(() => {
    regions.calls = 0;
  });
  afterEach(cleanup);

  it("puts Delivery at a glance above the delivery policy, with the live times", async () => {
    regions.read = async () => apiRegions;
    await renderRoute("delivery");
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]?.textContent).toContain("Delivery at a glance");
    expect(headings[0]?.closest("section")?.id).toBe("delivery-at-a-glance");
    expect(headings.length).toBeGreaterThan(1);
    expect(screen.getAllByRole("table")[0]?.textContent).toContain("European Union");
  });

  it("still shows the section, without times, when the regions cannot be read", async () => {
    regions.read = async () => {
      throw new Error("down");
    };
    await renderRoute("delivery");
    expect(screen.getAllByRole("heading", { level: 2 })[0]?.textContent).toContain(
      "Delivery at a glance",
    );
    expect(screen.getByText(/We can't show delivery times just now/)).toBeTruthy();
    expect(screen.queryByText("European Union")).toBeNull();
  });

  it("leaves every other policy as it is, and does not ask for the regions", async () => {
    await renderRoute("returns");
    expect(screen.queryByText("Delivery at a glance")).toBeNull();
    expect(regions.calls).toBe(0);
  });
});
