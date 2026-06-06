import { describe, expect, it } from "vitest";
import { buildVisiblePaletteSections } from "./palette-visible-sections";
import type { PaletteSection } from "./types";

const staticSections: PaletteSection[] = [
  {
    id: "suggested",
    heading: "Suggested",
    items: [{ id: "s1", href: "/admin", label: "Dashboard" }],
  },
  {
    id: "finance",
    heading: "Finance",
    items: [{ id: "p1", href: "/admin/payments", label: "Payments" }],
  },
  {
    id: "quick-actions",
    heading: "Quick actions",
    items: [{ id: "q1", href: "/admin/sales/new", label: "New sale" }],
  },
  {
    id: "actions",
    heading: "Actions",
    items: [{ id: "a1", href: "/search?q=pay", label: 'Search all lots for "pay"' }],
  },
];

const asyncSections: PaletteSection[] = [
  {
    id: "lots",
    heading: "Lots",
    items: [{ id: "l1", href: "/admin/lots/1", label: "Blue vase" }],
  },
];

describe("buildVisiblePaletteSections", () => {
  it("returns all static sections on empty query", () => {
    const visible = buildVisiblePaletteSections(staticSections, asyncSections, "");
    expect(visible.map((section) => section.id)).toEqual([
      "suggested",
      "finance",
      "quick-actions",
      "actions",
    ]);
  });

  it("hides ephemeral sections for single-character queries", () => {
    const visible = buildVisiblePaletteSections(staticSections, asyncSections, "p");
    expect(visible.some((section) => section.id === "suggested")).toBe(false);
    expect(visible.some((section) => section.id === "finance")).toBe(true);
  });

  it("merges pages, actions, and async sections for 2+ characters", () => {
    const visible = buildVisiblePaletteSections(staticSections, asyncSections, "pay");
    expect(visible.map((section) => section.id)).toEqual(["finance", "actions", "lots"]);
  });

  it("drops empty async sections", () => {
    const visible = buildVisiblePaletteSections(staticSections, [], "pay");
    expect(visible.map((section) => section.id)).toEqual(["finance", "actions"]);
  });
});
