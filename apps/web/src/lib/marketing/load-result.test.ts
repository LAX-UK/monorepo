import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFailed, loaded, settle } from "./load-result";

describe("settle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the value when the read succeeds, including an empty list", async () => {
    expect(await settle("test", async () => [])).toEqual(loaded([]));
  });

  it("returns a failed result and logs server-side when the read throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await settle("calendar", async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
    });
    expect(result).toEqual(loadFailed());
    expect(log).toHaveBeenCalledWith("[calendar] load failed", expect.any(Error));
  });
});
