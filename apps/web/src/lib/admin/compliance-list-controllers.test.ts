import { describe, expect, it } from "vitest";
import { amlListController, sofListController } from "./admin-list-controllers";

describe("amlListController.parseQuery", () => {
  it("caps page size at 100", () => {
    const q = amlListController.parseQuery({ limit: "500" });
    expect(q.limit).toBe(100);
  });

  it("defaults offset to 0", () => {
    const q = amlListController.parseQuery({});
    expect(q.offset).toBe(0);
  });
});

describe("sofListController.parseQuery", () => {
  it("caps page size at 100", () => {
    const q = sofListController.parseQuery({ limit: "200" });
    expect(q.limit).toBe(100);
  });

  it("parses offset from search params", () => {
    const q = sofListController.parseQuery({ offset: "50" });
    expect(q.offset).toBe(50);
  });
});
