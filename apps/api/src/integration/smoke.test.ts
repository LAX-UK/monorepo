import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("integration smoke", () => {
  it("exports app factory", () => {
    expect(typeof createApp).toBe("function");
  });
});
