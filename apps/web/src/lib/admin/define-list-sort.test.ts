import { describe, expect, it } from "vitest";
import { defineListSort } from "./define-list-sort";

const sort = defineListSort(
  {
    joined: { asc: "created_asc", desc: "created_desc" },
    name: { asc: "name_asc", desc: "name_desc" },
  },
  "created_desc",
);

describe("defineListSort", () => {
  it("always shows a sort, falling back to the default", () => {
    expect(sort.state(undefined)).toEqual({ columnId: "joined", direction: "desc" });
    expect(sort.state("nonsense")).toEqual({ columnId: "joined", direction: "desc" });
    expect(sort.state("name_asc")).toEqual({ columnId: "name", direction: "asc" });
  });

  it("leaves the URL clean for the default and names the key otherwise", () => {
    expect(sort.param({ columnId: "joined", direction: "desc" })).toBeNull();
    expect(sort.param({ columnId: "joined", direction: "asc" })).toBe("created_asc");
    expect(sort.param({ columnId: "unknown", direction: "asc" })).toBeNull();
  });

  it("refuses a default that no column offers", () => {
    expect(() => defineListSort({}, "x")).toThrow();
  });
});
