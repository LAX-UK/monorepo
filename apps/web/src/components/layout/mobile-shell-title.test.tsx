import { MobileShellTitle } from "@/components/layout/mobile-shell-title";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("MobileShellTitle", () => {
  it("renders a section root title without a back button", () => {
    render(
      <MobileShellTitle
        items={[{ label: "Dashboard", href: "/home" }, { label: "Watchlist" }]}
        model={{ title: "Watchlist" }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Watchlist" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /back/i })).not.toBeInTheDocument();
  });

  it("renders a back control and nested title", () => {
    render(
      <MobileShellTitle
        items={[
          { label: "Dashboard", href: "/home" },
          { label: "Settings", href: "/settings" },
          { label: "Profile" },
        ]}
        model={{
          title: "Profile",
          backHref: "/settings",
          backLabel: "Settings",
          eyebrow: "Settings",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Settings/i })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("does not use absolute positioning", () => {
    const { container } = render(
      <MobileShellTitle items={[{ label: "Dashboard", href: "/home" }, { label: "Watchlist" }]} />,
    );

    for (const node of container.querySelectorAll("*")) {
      expect(node.className).not.toMatch(/\babsolute\b/);
    }
  });
});
