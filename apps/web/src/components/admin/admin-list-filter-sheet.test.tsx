import { AdminListFilterSheet } from "@/components/admin/admin-list-filter-sheet";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AdminListFilterSheet", () => {
  it("shows filter trigger only below lg breakpoint", () => {
    render(
      <AdminListFilterSheet activeCount={2}>
        <p>Filter body</p>
      </AdminListFilterSheet>,
    );

    const triggerWrap = screen.getByRole("button", { name: /filters/i }).parentElement;
    expect(triggerWrap?.className).toMatch(/lg:hidden/);
  });
});
