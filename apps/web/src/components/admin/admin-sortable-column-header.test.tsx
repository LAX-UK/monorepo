import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminSortableColumnHeader } from "./admin-sortable-column-header";

describe("AdminSortableColumnHeader", () => {
  it("renders active sort label", () => {
    render(
      <AdminSortableColumnHeader
        label="Ends"
        sortValue="endingAsc"
        currentSort="endingAsc"
        href="/admin/lots?sort=endingAsc"
      />,
    );
    expect(screen.getByRole("link", { name: /Sorted ascending/i })).toBeInTheDocument();
  });
});
