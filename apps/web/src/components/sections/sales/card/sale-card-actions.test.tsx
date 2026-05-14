import { SaleCardActions } from "@/components/sections/sales/card/sale-card-actions";
import type { SaleAction } from "@/components/sections/sales/card/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const actions: SaleAction[] = [
  { id: "a", label: "Secondary", href: "/b", variant: "outline" },
  { id: "b", label: "Primary", href: "/a", variant: "cta" },
];

describe("SaleCardActions", () => {
  it("renders one link per action with correct hrefs and labels", () => {
    render(<SaleCardActions actions={actions} />);
    expect(screen.getByRole("link", { name: "Secondary" })).toHaveAttribute("href", "/b");
    expect(screen.getByRole("link", { name: "Primary" })).toHaveAttribute("href", "/a");
  });

  it("applies full-width layout on root for mobile stacking", () => {
    const { container } = render(<SaleCardActions actions={actions} />);
    const root = container.firstElementChild;
    expect(root).toHaveClass("flex-col", "sm:flex-row");
  });
});
