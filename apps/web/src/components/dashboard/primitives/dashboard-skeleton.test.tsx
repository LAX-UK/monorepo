import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardSkeleton", () => {
  it("renders a wrapper with PageSkeleton content", () => {
    const { container } = render(<DashboardSkeleton variant="list" />);
    const root = container.firstElementChild;
    expect(root?.className).toMatch(/min-h-/);
  });

  it("renders listWithToolbar variant with toolbar and row placeholders", () => {
    const { container } = render(<DashboardSkeleton variant="listWithToolbar" />);
    expect(container.querySelector("[data-testid='dashboard-skeleton-toolbar']")).toBeTruthy();
    expect(
      container.querySelectorAll("[data-testid='dashboard-skeleton-row']").length,
    ).toBeGreaterThan(0);
  });
});
