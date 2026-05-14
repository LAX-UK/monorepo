import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardErrorAlert", () => {
  it("renders title and message", () => {
    render(<DashboardErrorAlert message="Network error" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("allows custom title", () => {
    render(<DashboardErrorAlert title="Load failed" message="Try again." />);
    expect(screen.getByText("Load failed")).toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();
  });
});
