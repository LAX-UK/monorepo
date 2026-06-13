import { describe, expect, it } from "vitest";
import {
  NO_STORE_FETCH_POLICY,
  fetchInitFromPolicy,
  mergeFetchInitWithPolicy,
  revalidateFetchPolicy,
} from "./server-fetch-policy";

describe("server-fetch-policy", () => {
  it("no-store policy sets cache no-store", () => {
    expect(fetchInitFromPolicy(NO_STORE_FETCH_POLICY)).toEqual({ cache: "no-store" });
  });

  it("revalidate policy passes seconds and tags", () => {
    expect(fetchInitFromPolicy(revalidateFetchPolicy(60, ["catalogue-lots"]))).toEqual({
      next: { revalidate: 60, tags: ["catalogue-lots"] },
    });
  });

  it("mergeFetchInitWithPolicy lets policy win and avoids cache+next conflict", () => {
    const merged = mergeFetchInitWithPolicy(revalidateFetchPolicy(30), {
      cache: "no-store",
      headers: { "x-test": "1" },
    });
    expect(merged).toEqual({
      headers: { "x-test": "1" },
      next: { revalidate: 30 },
    });
    expect(merged.cache).toBeUndefined();
  });
});
