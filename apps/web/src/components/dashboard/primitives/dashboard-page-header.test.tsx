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

  it("leaves out the empty text block on phones, so the first action sits at the top", () => {
    render(
      <DashboardPageHeader
        title="Consignments"
        description="Works you've sent."
        hideTitleOnMobile
        hideDescriptionOnMobile
        actions={<button type="button">Sell a work</button>}
      />,
    );
    const block = screen.getByRole("heading", { level: 1, name: "Consignments" }).parentElement;
    expect(block?.className).toMatch(/hidden lg:block/);
  });

  it("keeps the text block on phones while a description shows there", () => {
    render(
      <DashboardPageHeader
        title="Consignments"
        description="Works you've sent."
        hideTitleOnMobile
        actions={<button type="button">Sell a work</button>}
      />,
    );
    const block = screen.getByRole("heading", { level: 1, name: "Consignments" }).parentElement;
    expect(block?.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("uses compact title scale by default", () => {
    render(<DashboardPageHeader title="Portfolio" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Portfolio" });
    expect(heading.className).toMatch(/text-xl/);
    expect(heading.className).toMatch(/sm:text-2xl/);
    expect(heading.className).toMatch(/lg:text-\[1\.75rem\]/);
  });

  it("uses display title scale for overview hero", () => {
    render(<DashboardPageHeader title="Welcome back" titleScale="display" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Welcome back" });
    expect(heading.className).toMatch(/text-3xl/);
    expect(heading.className).toMatch(/lg:text-4xl/);
  });

  it("omits page h1 below lg when hideTitleOnMobile is set", () => {
    render(<DashboardPageHeader title="Portfolio" hideTitleOnMobile />);

    const heading = screen.getByRole("heading", { level: 1, name: "Portfolio" });
    expect(heading.className).toMatch(/hidden lg:block/);
  });

  it("visually hides description on mobile when hideDescriptionOnMobile is set", () => {
    render(
      <DashboardPageHeader
        title="Portfolio"
        hideDescriptionOnMobile
        description="Your acquired lots and settlement status."
      />,
    );

    const description = screen.getByText("Your acquired lots and settlement status.");
    expect(description.className).toMatch(/hidden lg:block/);
  });
});

describe("DashboardPageHeader on the public site", () => {
  it("uses the shared account page header, always showing title and description", () => {
    render(
      <ClientLayoutProvider layout="website">
        <DashboardPageHeader
          title="My bids"
          hideTitleOnMobile
          hideDescriptionOnMobile
          description="Your bids in current and past sales."
          actions={<a href="/auctions">Browse upcoming sales</a>}
        />
      </ClientLayoutProvider>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "My bids" });
    expect(heading.className).not.toMatch(/hidden/);
    expect(heading.className).toMatch(/md:text-\[2rem\]/);
    expect(screen.getByText("Your bids in current and past sales.").className).not.toMatch(
      /hidden/,
    );
    expect(screen.getByRole("link", { name: "Browse upcoming sales" })).toBeInTheDocument();
  });
});
