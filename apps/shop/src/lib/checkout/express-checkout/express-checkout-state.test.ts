import { describe, expect, it } from "vitest";
import {
  type ExpressRowEvent,
  type ExpressRowState,
  INITIAL_EXPRESS_ROW_STATE,
  expressRowReducer,
  expressRowReservesSpace,
  expressRowShowsButtons,
} from "./express-checkout-state";

function run(events: ExpressRowEvent[], from: ExpressRowState = INITIAL_EXPRESS_ROW_STATE) {
  return events.reduce(expressRowReducer, from);
}

describe("express checkout row states", () => {
  it("starts loading with its height reserved", () => {
    expect(INITIAL_EXPRESS_ROW_STATE).toEqual({ status: "loading" });
    expect(expressRowReservesSpace(INITIAL_EXPRESS_ROW_STATE)).toBe(true);
  });

  it("shows the buttons once a wallet is available", () => {
    const state = run([{ type: "loaded", available: true }]);
    expect(state).toEqual({ status: "ready", notice: null });
    expect(expressRowShowsButtons(state)).toBe(true);
  });

  it("hides the row, with no space kept, when no wallet is available or the flag is off", () => {
    for (const state of [
      run([{ type: "loaded", available: false }]),
      run([{ type: "disabled" }]),
    ]) {
      expect(state).toEqual({ status: "unavailable" });
      expect(expressRowReservesSpace(state)).toBe(false);
      expect(expressRowShowsButtons(state)).toBe(false);
    }
  });

  it("replaces a row that could not load with one line", () => {
    const state = run([{ type: "load_failed", message: "Unavailable" }]);
    expect(state).toEqual({ status: "error", message: "Unavailable" });
    expect(expressRowShowsButtons(state)).toBe(false);
  });

  it("ignores a late load failure once the buttons are there", () => {
    const state = run([
      { type: "loaded", available: true },
      { type: "load_failed", message: "late timeout" },
    ]);
    expect(state).toEqual({ status: "ready", notice: null });
  });

  it("goes from confirm to paid", () => {
    const state = run([
      { type: "loaded", available: true },
      { type: "confirm_started" },
      { type: "paid", orderId: "o1" },
    ]);
    expect(state).toEqual({ status: "paid", orderId: "o1" });
    // Nothing changes a paid row: the shopper is on the way to the confirmation.
    expect(expressRowReducer(state, { type: "not_charged", message: "x" })).toBe(state);
    expect(expressRowReducer(state, { type: "cancelled", message: "x" })).toBe(state);
  });

  it("keeps the buttons after a refusal and says nothing was charged", () => {
    const state = run([
      { type: "loaded", available: true },
      { type: "confirm_started" },
      { type: "not_charged", message: "You have not been charged." },
    ]);
    expect(state).toEqual({
      status: "ready",
      notice: { tone: "error", message: "You have not been charged." },
    });
  });

  it("says the print sold out and drops the buttons", () => {
    const state = run([
      { type: "loaded", available: true },
      { type: "confirm_started" },
      { type: "sold_out", message: "This print has just sold out" },
    ]);
    expect(state).toEqual({ status: "sold_out", message: "This print has just sold out" });
    expect(expressRowShowsButtons(state)).toBe(false);
  });

  it("notes a closed sheet quietly, and clears an older notice on the next confirm", () => {
    const cancelled = run([
      { type: "loaded", available: true },
      { type: "cancelled", message: "Payment cancelled. You have not been charged." },
    ]);
    expect(cancelled).toEqual({
      status: "ready",
      notice: { tone: "info", message: "Payment cancelled. You have not been charged." },
    });
    expect(expressRowReducer(cancelled, { type: "confirm_started" })).toEqual({
      status: "processing",
    });
  });

  it("shows a refused address and ignores events that do not fit the state", () => {
    const ready = run([{ type: "loaded", available: true }]);
    expect(expressRowReducer(ready, { type: "address_refused", message: "UK only" })).toEqual({
      status: "ready",
      notice: { tone: "error", message: "UK only" },
    });
    expect(run([{ type: "confirm_started" }])).toEqual({ status: "loading" });
    expect(run([{ type: "paid", orderId: "o1" }])).toEqual({ status: "loading" });
    expect(
      run([
        { type: "loaded", available: true },
        { type: "loaded", available: false },
      ]),
    ).toEqual(ready);
  });
});
