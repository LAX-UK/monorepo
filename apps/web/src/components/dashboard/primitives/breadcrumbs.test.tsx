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
});
