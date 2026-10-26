import { describe, expect, it } from "vitest";
import { parseWorkingDayWindow } from "./checkout-delivery";
import {
  DEFAULT_COLLECTION_READY_WORKING_DAYS,
  DEFAULT_UK_DELIVERY_WORKING_DAYS,
} from "./checkout-delivery.server";

describe("provisional delivery times", () => {
  it("are valid working-day windows", () => {
    expect(parseWorkingDayWindow(DEFAULT_UK_DELIVERY_WORKING_DAYS)).toEqual({ min: 3, max: 5 });
    expect(parseWorkingDayWindow(DEFAULT_COLLECTION_READY_WORKING_DAYS)).toEqual({
      min: 2,
      max: 2,
    });
  });
});
