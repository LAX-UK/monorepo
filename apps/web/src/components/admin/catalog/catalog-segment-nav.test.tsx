import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogSegmentNav } from "./catalog-segment-nav";

describe("CatalogSegmentNav", () => {
  const items = [
    { id: "all", label: "All", href: "/admin/sales", badge: 4 },
    { id: "live", label: "Live", href: "/admin/sales?lens=live", badge: 12 },
  ] as const;

  it("renders count badges on lens tabs", () => {
    render(<CatalogSegmentNav items={items} activeId="all" aria-label="Sale lifecycle" />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("applies distinct badge styles for active vs inactive tabs", () => {
    render(<CatalogSegmentNav items={items} activeId="all" aria-label="Sale lifecycle" />);
    const activeBadge = screen.getByText("4");
    const inactiveBadge = screen.getByText("12");
    expect(activeBadge.className).toContain("bg-secondary");
    expect(inactiveBadge.className).toContain("bg-surface-container-high");
  });
});
