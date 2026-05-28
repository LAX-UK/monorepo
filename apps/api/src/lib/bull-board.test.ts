import { describe, expect, it } from "vitest";
import { assertBullBoardProductionSafety } from "./bull-board.js";

describe("assertBullBoardProductionSafety", () => {
  it("passes with current registry in production", () => {
    expect(() =>
      assertBullBoardProductionSafety({
        APP_ENV: "production",
        NODE_ENV: "production",
      } as never),
    ).not.toThrow();
  });

  it("passes in non-production", () => {
    expect(() =>
      assertBullBoardProductionSafety({
        APP_ENV: "development",
        NODE_ENV: "development",
      } as never),
    ).not.toThrow();
  });
});
