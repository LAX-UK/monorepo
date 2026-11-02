import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { ClientLayoutProvider } from "@/components/layout/client-layout-context";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardPageHeader", () => {
  it("renders actions with mobile top margin for breathing room", () => {
    render(
      <DashboardPageHeader
        title="Your submissions"
        description="Submit item details."
        actions={<button type="button">New submission</button>}
      />,
    );

    expect(screen.getByRole("button", { name: /new submission/i })).toBeInTheDocument();
    const actionsWrap = screen.getByRole("button", { name: /new submission/i }).parentElement;
    expect(actionsWrap?.className).toMatch(/flex shrink-0/);
  });

  it("keeps the text block on phones, where it is the large title", () => {
    render(
      <DashboardPageHeader
        title="Consignments"
        description="Works you've sent."
        actions={<button type="button">Sell a work</button>}
      />,
    );
    const block = screen.getByRole("heading", { level: 1, name: "Consignments" }).parentElement;
    expect(block?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("draws the title on the one page-title scale: 24/32, 28/36 from tablet up", () => {
    render(<DashboardPageHeader title="Portfolio" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Portfolio" });
    expect(heading.className).toMatch(/(^|\s)text-lax-24(\s|$)/);
    expect(heading.className).toMatch(/md:text-lax-28/);
  });

  it("keeps the page title and description on phones, as the large title", () => {
    render(
      <DashboardPageHeader
        title="Portfolio"
        description="Your acquired lots and settlement status."
      />,
    );
    const heading = screen.getByRole("heading", { level: 1, name: "Portfolio" });
    expect(heading.className).not.toMatch(/hidden/);
    expect(heading).toHaveAttribute("data-page-title");
    expect(screen.getByText("Your acquired lots and settlement status.").className).not.toMatch(
      /hidden/,
    );
  });
});

describe("DashboardPageHeader on the public site", () => {
  it("uses the workspace page header, the same element as the organisation workspace", () => {
    render(
      <ClientLayoutProvider layout="website">
        <DashboardPageHeader
          title="My bids"
          description="Your bids in current and past sales."
          actions={<a href="/auctions">Browse upcoming sales</a>}
        />
      </ClientLayoutProvider>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "My bids" });
    expect(heading.className).not.toMatch(/hidden/);
    expect(heading).toHaveAttribute("data-page-title");
    expect(heading.className).toMatch(/md:text-lax-28/);
    expect(screen.getByText("Your bids in current and past sales.").className).not.toMatch(
      /hidden/,
    );
    expect(screen.getByRole("link", { name: "Browse upcoming sales" })).toBeInTheDocument();
  });
});
