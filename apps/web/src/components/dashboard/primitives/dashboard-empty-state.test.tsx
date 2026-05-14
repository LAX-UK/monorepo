import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardEmptyState", () => {
  it("renders title and description", () => {
    render(<DashboardEmptyState title="Nothing here" description="Add items to see them." />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add items to see them.")).toBeInTheDocument();
  });
});
