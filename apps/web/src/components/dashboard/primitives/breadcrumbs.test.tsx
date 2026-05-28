import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Breadcrumbs", () => {
  it("gives links a 44px min tap target on mobile", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Submissions", href: "/dashboard/submissions" },
          { label: "Draft" },
        ]}
      />,
    );

    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.className).toMatch(/min-h-11/);
    }
  });

  it("marks the final crumb with aria-current=page", () => {
    render(
      <Breadcrumbs
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Current page" }]}
      />,
    );

    expect(screen.getByText("Current page")).toHaveAttribute("aria-current", "page");
  });

  it("marks the current slot with aria-current=page", () => {
    render(<Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }]} current="Lot 42" />);

    expect(screen.getByText("Lot 42")).toHaveAttribute("aria-current", "page");
  });

  it("renders a single-line compact trail with root link and truncated current page", () => {
    const { container } = render(
      <Breadcrumbs
        compact
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Seller", href: "/dashboard/seller" },
          { label: "Watchlist" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Watchlist")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Seller" })).not.toBeInTheDocument();

    const list = container.querySelector("ol");
    expect(list?.className).toMatch(/flex-nowrap/);
    expect(list?.className).not.toMatch(/flex-wrap/);
  });

  it("renders only the current label in compact mode when the trail is a single page", () => {
    render(<Breadcrumbs compact items={[{ label: "Dashboard" }]} />);

    expect(screen.getByText("Dashboard")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
