import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

describe("GET /v1/delivery-regions", () => {
  it("tells the storefront the regions, lead times and countries not delivered to, never cached", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/delivery-regions" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json();
    expect(body.regions).toHaveLength(4);
    expect(body.regions[0]).toMatchObject({
      id: "uk",
      name: "United Kingdom",
      standard: { minDays: 5, maxDays: 10 },
      fixedPricePence: 1500,
      countries: ["GB"],
    });
    expect(body.regions[2]).toMatchObject({ id: "north_america", countries: ["US", "CA"] });
    expect(body.notDeliveredTo).toEqual(expect.arrayContaining([{ code: "RU", name: "Russia" }]));
    expect(body).not.toHaveProperty("countryChoices");
    await app.close();
  });
});
