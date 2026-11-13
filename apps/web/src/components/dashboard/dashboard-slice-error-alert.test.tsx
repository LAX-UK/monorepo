import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/legal-entity/submissions-access-actions", () => ({
  usePersonalProfileForSubmissions: vi.fn(),
}));

const { DashboardSliceErrorAlert } = await import("./dashboard-slice-error-alert");

describe("DashboardSliceErrorAlert", () => {
  it("says what failed in plain words with Try again", () => {
    render(
      <DashboardSliceErrorAlert failure={buildDashboardSliceFailure("orgMembers", 500, null)} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Members couldn't be loaded",
    );
    expect(screen.getByText("This is on our side. Try again in a moment.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Try again" })).toBeVisible();
  });

  it("takes the surface's own title and heading level inside a section", () => {
    render(
      <DashboardSliceErrorAlert
        failure={buildDashboardSliceFailure("submissions", 500, null)}
        headingLevel="h3"
        title="Your documents couldn't be loaded"
      />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Your documents couldn't be loaded",
    );
  });
});
