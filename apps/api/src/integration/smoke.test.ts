import { describe, expect, it } from "vitest";

describe("integration smoke", () => {
  it("exports app factory", async () => {
    const { createApp } = await import("../app.js");
    expect(typeof createApp).toBe("function");
  });
});
