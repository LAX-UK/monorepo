import { describe, expect, it } from "vitest";
import { heroAction } from "./hero-action";

describe("heroAction", () => {
  it("sends a hybrid or onsite sale in session to the saleroom", () => {
    expect(heroAction({ deliveryMode: "hybrid", status: "active" }).label).toBe(
      "Join the saleroom",
    );
    expect(heroAction({ deliveryMode: "onsite", status: "active" }).label).toBe(
      "Join the saleroom",
    );
  });

  it("shows the lots of a timed online sale", () => {
    expect(heroAction({ deliveryMode: "online", status: "active" }).label).toBe("View lots");
  });

  it("shows the lots of a sale that has not opened", () => {
    expect(heroAction({ deliveryMode: "hybrid", status: "scheduled" }).label).toBe("View lots");
    expect(heroAction({ status: "scheduled" }).label).toBe("View lots");
  });
});
