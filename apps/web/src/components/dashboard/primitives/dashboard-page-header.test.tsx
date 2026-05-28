import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
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

  it("uses compact title scale by default", () => {
    render(<DashboardPageHeader title="Portfolio" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Portfolio" });
    expect(heading.className).toMatch(/text-2xl/);
    expect(heading.className).toMatch(/lg:text-3xl/);
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
