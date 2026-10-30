import { describe, expect, it } from "vitest";
import { deliveryQuoteActionsFor, deliveryQuoteTransition } from "./delivery-quote.js";

describe("deliveryQuoteTransition", () => {
  it("lets the buyer ask for a quote when none exists", () => {
    expect(deliveryQuoteTransition(null, "request", "buyer")).toEqual({
      allowed: true,
      next: "requested",
    });
  });

  it("lets the buyer ask again after withdrawing", () => {
    expect(deliveryQuoteTransition("withdrawn", "request", "buyer")).toEqual({
      allowed: true,
      next: "requested",
    });
  });

  it("does not open a second request while one is pending", () => {
    expect(deliveryQuoteTransition("requested", "request", "buyer")).toEqual({
      allowed: false,
      reason: "quote_step_not_allowed",
    });
  });

  it("lets staff price a requested quote and revise a quoted one", () => {
    expect(deliveryQuoteTransition("requested", "quote", "staff")).toEqual({
      allowed: true,
      next: "quoted",
    });
    expect(deliveryQuoteTransition("quoted", "quote", "staff")).toEqual({
      allowed: true,
      next: "quoted",
    });
  });

  it("never lets the buyer price a quote, nor staff accept one", () => {
    expect(deliveryQuoteTransition("requested", "quote", "buyer")).toEqual({
      allowed: false,
      reason: "quote_wrong_actor",
    });
    expect(deliveryQuoteTransition("quoted", "accept", "staff")).toEqual({
      allowed: false,
      reason: "quote_wrong_actor",
    });
  });

  it("accepts only a priced quote", () => {
    expect(deliveryQuoteTransition("quoted", "accept", "buyer")).toEqual({
      allowed: true,
      next: "accepted",
    });
    expect(deliveryQuoteTransition("requested", "accept", "buyer").allowed).toBe(false);
  });

  it("treats an accepted quote as final", () => {
    for (const action of ["request", "accept", "withdraw"] as const) {
      expect(deliveryQuoteTransition("accepted", action, "buyer").allowed).toBe(false);
    }
    expect(deliveryQuoteTransition("accepted", "quote", "staff").allowed).toBe(false);
  });
});

describe("deliveryQuoteActionsFor", () => {
  it("offers each side only the steps that will work", () => {
    expect(deliveryQuoteActionsFor(null, "buyer")).toEqual(["request"]);
    expect(deliveryQuoteActionsFor("quoted", "buyer")).toEqual(["accept", "withdraw"]);
    expect(deliveryQuoteActionsFor("requested", "staff")).toEqual(["quote"]);
    expect(deliveryQuoteActionsFor("accepted", "staff")).toEqual([]);
  });
});
