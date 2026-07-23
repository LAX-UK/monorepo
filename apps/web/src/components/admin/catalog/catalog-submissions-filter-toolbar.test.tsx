import { CatalogSubmissionsFilterToolbar } from "@/components/admin/catalog/catalog-submissions-filter-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("CatalogSubmissionsFilterToolbar", () => {
  it("does not render removed sticky shortcut buttons", () => {
    render(
      <CatalogSubmissionsFilterToolbar
        lenses={[{ id: "pending", label: "Pending", href: "/admin/submissions?queue=pending" }]}
        activeLensId="pending"
        activeFilterCount={2}
        activeFilterChips={[
          {
            id: "assignedTo",
            label: "Assigned to me",
            clearHref: "/admin/submissions?queue=pending",
          },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: /my queue/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sort by sla/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /quality gaps/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Pending" })).toBeInTheDocument();
    expect(screen.getByText("Assigned to me")).toBeInTheDocument();
  });
});
