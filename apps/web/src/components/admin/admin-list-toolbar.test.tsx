import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AdminListToolbar", () => {
  it("renders filters inline in the toolbar", () => {
    render(<AdminListToolbar filters={<span data-testid="filter-chip">Status</span>} hasFilters />);

    expect(screen.getByTestId("filter-chip")).toBeVisible();
    expect(screen.getByText("Reset filters")).toBeVisible();
  });
});
