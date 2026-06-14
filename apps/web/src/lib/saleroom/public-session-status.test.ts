import { describe, expect, it } from "vitest";
import { isSaleroomSessionActive, isSaleroomSessionLive } from "./public-session-status";

describe("public saleroom session status", () => {
  it("treats live and paused as active for UX badges", () => {
    expect(isSaleroomSessionActive("live")).toBe(true);
    expect(isSaleroomSessionActive("paused")).toBe(true);
    expect(isSaleroomSessionActive("none")).toBe(false);
  });

  it("treats only live as bid-eligible", () => {
    expect(isSaleroomSessionLive("live")).toBe(true);
    expect(isSaleroomSessionLive("paused")).toBe(false);
    expect(isSaleroomSessionLive("none")).toBe(false);
  });
});
