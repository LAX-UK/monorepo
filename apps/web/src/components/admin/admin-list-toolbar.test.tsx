import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AdminListToolbar", () => {
  it("shows inline filters only at lg breakpoint", () => {
    render(<AdminListToolbar filters={<span data-testid="filter-chip">Status</span>} hasFilters />);

    const inlineWrap = screen.getByTestId("filter-chip").parentElement;
    expect(inlineWrap?.className).toMatch(/\bhidden\b/);
    expect(inlineWrap?.className).toMatch(/\blg:flex\b/);
  });
});
