import { PressCoverageCardActions } from "@/components/sections/press/press-coverage-card-actions";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("PressCoverageCardActions", () => {
  it("renders share controls and a working external article link", () => {
    render(
      <PressCoverageCardActions
        url="https://bbc.co.uk/article"
        headline="Auction highlights"
        outletName="BBC"
        dateLabel="14 Nov 2025"
        publishedAt="2025-11-14"
      />,
    );

    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share on X" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share on LinkedIn" })).toBeInTheDocument();

    const externalLink = screen.getByRole("link", { name: "Read on BBC (opens in new tab)" });
    expect(externalLink).toHaveAttribute("href", "https://bbc.co.uk/article");
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText("14 Nov 2025")).toBeInTheDocument();
  });
});
