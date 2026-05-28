import { DashboardDetailHeader } from "@/components/dashboard/primitives/dashboard-detail-header";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardDetailHeader", () => {
  it("visually hides back link and title on mobile when compactOnMobile is set", () => {
    render(
      <DashboardDetailHeader
        compactOnMobile
        backHref="/dashboard/submissions"
        backLabel="Submissions"
        eyebrow="Selling"
        title="Submission detail"
        description="Review status and edits."
        badges={<span data-testid="badge">Draft</span>}
      />,
    );

    const backLink = screen.getByRole("link", { name: /submissions/i });
    expect(backLink.className).toMatch(/hidden lg:inline-flex/);

    const heading = screen.getByRole("heading", { level: 1, name: "Submission detail" });
    expect(heading.className).toMatch(/sr-only/);
    expect(heading.className).toMatch(/lg:not-sr-only/);

    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });
});
