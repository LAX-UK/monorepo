import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardErrorAlert } from "./dashboard-error-alert";

describe("DashboardErrorAlert", () => {
  it("titles the alert at h2 under the page title by default", () => {
    render(
      <DashboardErrorAlert
        title="Documents couldn't be loaded"
        message="This is on our side. Try again in a moment."
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Documents couldn't be loaded",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This is on our side. Try again in a moment.",
    );
  });

  it("takes the level of where it sits, h3 inside a section", () => {
    render(
      <DashboardErrorAlert
        title="Payout statements couldn't be loaded"
        headingLevel="h3"
        message="This is on our side. Try again in a moment."
      />,
    );
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 5 })).toBeNull();
  });

  it("sits on the danger tokens, not a faint tint of the error colour", () => {
    render(<DashboardErrorAlert title="Members couldn't be loaded" message="On our side." />);
    const card = screen.getByRole("alert");
    expect(card.className).toContain("bg-lax-danger-bg");
    expect(card.className).toContain("border-lax-danger/30");
    expect(card.className).not.toMatch(/bg-destructive\/5|border-destructive\/40/);
    expect(screen.getByRole("heading")).toHaveClass("font-semibold");
  });
});
