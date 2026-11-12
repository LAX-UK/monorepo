import { describe, expect, it } from "vitest";
import {
  REOFFER_UNAVAILABLE,
  bidderReofferEndedWhileAnswering,
  bidderReofferErrorMessage,
  bidderReofferIsSettled,
  bidderReofferPriceChanged,
} from "./bidder-reoffer-errors";

describe("refusals of the bidder's answer", () => {
  it("says an offer that ended while answering can no longer be accepted, and reloads", () => {
    expect(bidderReofferErrorMessage("offer_window_ended")).toBe(
      "This offer has ended. It can no longer be accepted.",
    );
    expect(bidderReofferIsSettled("offer_window_ended")).toBe(true);
    expect(bidderReofferEndedWhileAnswering("offer_window_ended")).toBe(true);
  });

  it("reloads after every refusal that means the offer or the lot has moved on", () => {
    for (const code of [
      "offer_not_open",
      "offer_superseded",
      "conflict",
      "lot_has_buyer",
      "lot_not_reawardable",
      "sold_on_atg",
    ]) {
      expect(bidderReofferIsSettled(code)).toBe(true);
      expect(bidderReofferEndedWhileAnswering(code)).toBe(false);
    }
  });

  it("reloads with the new total when the total changed since the page loaded", () => {
    expect(bidderReofferIsSettled("price_changed")).toBe(true);
    expect(bidderReofferPriceChanged("price_changed")).toBe(true);
    expect(bidderReofferEndedWhileAnswering("price_changed")).toBe(false);
    expect(bidderReofferErrorMessage("price_changed")).toContain("Nothing has been charged");
    expect(bidderReofferPriceChanged("conflict")).toBe(false);
    expect(bidderReofferPriceChanged(undefined)).toBe(false);
  });

  it("stays on the page for a refusal the person can act on, saying why in words", () => {
    expect(bidderReofferIsSettled("bidder_unavailable")).toBe(false);
    expect(bidderReofferErrorMessage("bidder_unavailable")).toContain("Contact us");
    expect(bidderReofferIsSettled("money_paused")).toBe(false);
    expect(bidderReofferIsSettled("terms_not_accepted")).toBe(false);
    expect(bidderReofferErrorMessage("terms_not_accepted")).toBe("Tick the box to accept.");
  });

  it("says an unknown refusal is on our side and changed nothing", () => {
    expect(bidderReofferErrorMessage("something_new")).toBe(REOFFER_UNAVAILABLE);
    expect(bidderReofferErrorMessage(undefined)).toBe(REOFFER_UNAVAILABLE);
    expect(bidderReofferIsSettled(undefined)).toBe(false);
  });
});
