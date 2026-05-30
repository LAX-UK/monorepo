import { describe, expect, it } from "vitest";
import {
  buildArtistsActiveFilterChips,
  buildConditionReportsActiveFilterChips,
  buildFulfilmentActiveFilterChips,
  buildLotsActiveFilterChips,
  buildSalesActiveFilterChips,
  buildSubmissionsActiveFilterChips,
} from "./catalog-active-filter-chips";

describe("buildLotsActiveFilterChips", () => {
  it("builds clear hrefs for search and entity filters", () => {
    const chips = buildLotsActiveFilterChips(
      { q: "vase", artistId: "a1", offset: "10" },
      {
        q: "vase",
        artistId: "a1",
        artistName: "Picasso",
        saleId: "",
        categoryId: "",
        activeLens: "all",
      },
    );
    expect(chips).toHaveLength(2);
    expect(chips[0]?.label).toContain("vase");
    expect(chips[0]?.clearHref).not.toContain("q=");
    expect(chips[1]?.label).toContain("Picasso");
    expect(chips[1]?.clearHref).not.toContain("artistId=");
  });
});

describe("buildArtistsActiveFilterChips", () => {
  it("includes featured chip when active", () => {
    const chips = buildArtistsActiveFilterChips({ featured: "true" }, { featured: true });
    expect(chips.some((c) => c.id === "featured")).toBe(true);
  });
});

describe("buildSalesActiveFilterChips", () => {
  it("omits sort when owned by setup lens", () => {
    const chips = buildSalesActiveFilterChips(
      { lens: "setup", status: "draft" },
      { status: "draft", deliveryMode: "online" },
    );
    expect(chips.some((c) => c.id === "status")).toBe(true);
    expect(chips.some((c) => c.id === "deliveryMode")).toBe(true);
  });
});

describe("buildConditionReportsActiveFilterChips", () => {
  it("shows lens chip when not on open queue", () => {
    const chips = buildConditionReportsActiveFilterChips(
      { lens: "pending" },
      { activeLens: "pending" },
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]?.clearHref).not.toContain("lens=");
  });
});

describe("buildFulfilmentActiveFilterChips", () => {
  it("shows status chip when filtered", () => {
    const chips = buildFulfilmentActiveFilterChips(
      { status: "awaiting_release" },
      { status: "awaiting_release" },
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]?.label).toContain("Awaiting release");
    expect(chips[0]?.clearHref).not.toContain("status=");
  });
});

describe("buildSubmissionsActiveFilterChips", () => {
  it("builds category chip with name", () => {
    const chips = buildSubmissionsActiveFilterChips(
      { categoryId: "cat-1", q: "vase" },
      { q: "vase", categoryId: "cat-1", categoryName: "Ceramics" },
    );
    expect(chips).toHaveLength(2);
    expect(chips.find((c) => c.id === "categoryId")?.label).toContain("Ceramics");
    expect(chips.find((c) => c.id === "categoryId")?.clearHref).not.toContain("categoryId=");
  });
});
