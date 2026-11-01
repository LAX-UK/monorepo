import { describe, expect, it, vi } from "vitest";
import { RedisCooldownStore } from "./redis-cooldown.store.js";

describe("RedisCooldownStore", () => {
  it("claims a key once until it expires", async () => {
    const taken = new Set<string>();
    const set = vi.fn(async (key: string) => {
      if (taken.has(key)) return null;
      taken.add(key);
      return "OK";
    });
    const store = new RedisCooldownStore({ set });
    expect(await store.claim("a", 60)).toBe(true);
    expect(await store.claim("a", 60)).toBe(false);
    expect(await store.claim("b", 60)).toBe(true);
    expect(set).toHaveBeenCalledWith("cooldown:a", "1", "EX", 60, "NX");
  });
});
