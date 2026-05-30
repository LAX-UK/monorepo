import { HeaderGuestMenu } from "@/components/layout/header-guest-menu";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/lot/foo/1",
  useSearchParams: () => new URLSearchParams("view=grid"),
}));

vi.mock("@/lib/auth/use-auth-header-links", () => ({
  useAuthHeaderLinks: () => ({
    signInHref: "/login?next=%2Flot%2Ffoo%2F1%3Fview%3Dgrid",
    registerHref: "/register?next=%2Flot%2Ffoo%2F1%3Fview%3Dgrid",
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("HeaderGuestMenu", () => {
  it("opens a menu with Sign in and Create account links", () => {
    render(<HeaderGuestMenu />);

    expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Account" }));

    expect(screen.getByRole("button", { name: "Account" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("menu", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Flot%2Ffoo%2F1%3Fview%3Dgrid",
    );
    expect(screen.getByRole("menuitem", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register?next=%2Flot%2Ffoo%2F1%3Fview%3Dgrid",
    );
  });
});
