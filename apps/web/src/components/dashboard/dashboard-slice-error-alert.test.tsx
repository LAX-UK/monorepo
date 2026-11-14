import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { buildDashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/legal-entity/submissions-access-actions", () => ({
  usePersonalProfileForSubmissions: vi.fn(),
}));

describe("DashboardSliceErrorAlert", () => {
  it("renders retry link action", () => {
    const failure = buildDashboardSliceFailure("bids", 500, null);
    render(<DashboardSliceErrorAlert failure={failure} />);
    expect(screen.getByText(failure.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try again/i })).toHaveAttribute(
      "href",
      failure.actions[0]?.href ?? "",
    );
  });

  it("renders sign-in for 401", () => {
    const failure = buildDashboardSliceFailure("portfolio", 401, null);
    render(<DashboardSliceErrorAlert failure={failure} />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the switch-to-personal-account form action", () => {
    const failure = buildDashboardSliceFailure("submissions", 403, "not_a_member_of_legal_entity");
    render(<DashboardSliceErrorAlert failure={failure} />);
    expect(screen.getByRole("button", { name: /personal account/i })).toBeInTheDocument();
  });

  it("says what failed in plain words with Try again", () => {
    render(
      <DashboardSliceErrorAlert failure={buildDashboardSliceFailure("orgMembers", 500, null)} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Members couldn't be loaded",
    );
    expect(screen.getByText("This is on our side. Try again in a moment.")).toBeVisible();
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
