import { describe, expect, it } from "vitest";
import { payoutsListController } from "./admin-list-controllers";

describe("payoutsListController.parseQuery", () => {
  it("defaults page size to 99 so fetch limit stays within API max 100", () => {
    const q = payoutsListController.parseQuery({});
    expect(q.limit).toBe(99);
  });

  it("caps explicit page size at 99", () => {
    const q = payoutsListController.parseQuery({ limit: "200" });
    expect(q.limit).toBe(99);
  });
});
