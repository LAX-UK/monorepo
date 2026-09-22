import { describe, expect, it } from "vitest";
import { buildHomePageViewModel } from "./home-page.vm.js";

describe("buildHomePageViewModel", () => {
  it("maps composed catalogue sections into card view models", () => {
    const vm = buildHomePageViewModel({
      originals: [],
      categories: [],
      prints: [],
      artists: [],
      sectionErrors: { prints: "offline" },
    });
    expect(vm.sectionErrors.prints).toBe("offline");
    expect(vm.printCards).toEqual([]);
    expect(vm.sections.prints.actionHref).toBe("/artworks?type=edition");
  });

  it("exposes stable section metadata", () => {
    const vm = buildHomePageViewModel({
      originals: [],
      categories: [],
      prints: [],
      artists: [],
      sectionErrors: {},
    });
    expect(vm.sections.prints.title).toBe("Prints & Multiples");
  });
});
