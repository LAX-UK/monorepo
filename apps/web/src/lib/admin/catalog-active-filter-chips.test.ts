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

  it("includes department and country chips when active", () => {
    const chips = buildArtistsActiveFilterChips(
      { categoryId: "cat-1", country: "GB" },
      { categoryId: "cat-1", categoryName: "Ceramics", country: "GB" },
    );
    expect(chips.find((c) => c.id === "categoryId")?.label).toContain("Ceramics");
    expect(chips.find((c) => c.id === "country")?.label).toContain("GB");
  });
});

describe("buildSalesActiveFilterChips", () => {
  it("humanizes status and delivery filters", () => {
    const chips = buildSalesActiveFilterChips(
      { status: "draft", delivery: "online" },
      { status: "draft", deliveryMode: "online" },
    );
    expect(chips.find((c) => c.id === "status")?.label).toBe("Status: Draft");
    expect(chips.find((c) => c.id === "deliveryMode")?.label).toBe("Delivery: Online");
  });

  it("includes lifecycle and sort chips when not lens-owned", () => {
    const chips = buildSalesActiveFilterChips(
      { lifecycle: "upcoming", sort: "startAsc" },
      {
        lifecycle: "upcoming",
        sort: "startAsc",
        activeLensId: "all",
        lensOwnedLifecycle: false,
      },
    );
    expect(chips.find((c) => c.id === "lifecycle")?.label).toContain("Upcoming");
    expect(chips.find((c) => c.id === "sort")?.label).toContain("Starting soonest");
  });

  it("includes setup lens chip", () => {
    const chips = buildSalesActiveFilterChips(
      { lens: "setup", status: "draft" },
      { status: "draft", setupLens: true, activeLensId: "setup" },
    );
    expect(chips.some((c) => c.id === "lens")).toBe(true);
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
