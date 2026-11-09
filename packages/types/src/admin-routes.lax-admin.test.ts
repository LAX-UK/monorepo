import { describe, expect, it } from "vitest";
import { laxAdminRoutes } from "./admin-routes.js";

describe("laxAdminRoutes", () => {
  it("links an order to its page in LAX Admin, with the id encoded", () => {
    expect(laxAdminRoutes.orders.order("11111111-1111-4111-8111-111111111111")).toBe(
      "/orders/11111111-1111-4111-8111-111111111111",
    );
    expect(laxAdminRoutes.orders.order("a/b")).toBe("/orders/a%2Fb");
  });
});
