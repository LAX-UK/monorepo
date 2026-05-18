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
    const button = screen.getByRole("button", { name: /new submission/i });
    expect(button.parentElement?.className).toMatch(/mt-4/);
    expect(button.parentElement?.className).toMatch(/md:mt-0/);
  });

  it("uses compact title scale by default", () => {
    const { container } = render(<DashboardPageHeader title="Portfolio" />);
    expect(container.firstChild).toHaveClass("[&_h1]:text-2xl");
    expect(container.firstChild).toHaveClass("[&_h1]:md:text-3xl");
  });

  it("uses display title scale for overview hero", () => {
    const { container } = render(<DashboardPageHeader title="Welcome back" titleScale="display" />);
    expect(container.firstChild).toHaveClass("[&_h1]:text-3xl");
    expect(container.firstChild).toHaveClass("[&_h1]:md:text-4xl");
  });
});
