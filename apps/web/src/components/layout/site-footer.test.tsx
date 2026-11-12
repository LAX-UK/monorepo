import { SiteFooter } from "@/components/layout/site-footer";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  user: null as { role: string; staffRoles: string[] } | null,
}));

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: session.user, pending: false }),
}));
vi.mock("@/lib/analytics/consent/context", () => ({
  useConsent: () => ({ openPreferences: () => {} }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/about" }));

const accountLabels = () => {
  const list = screen.getByRole("heading", { name: "Account" }).closest("div,section,nav");
  return within(list as HTMLElement)
    .getAllByRole("link")
    .map((link) => link.textContent);
};

describe("SiteFooter", () => {
  beforeEach(() => {
    session.user = null;
  });

  it("draws the Account column from the session island, a visitor first", () => {
    render(<SiteFooter />);
    expect(accountLabels()).toContain("Sign in");
    expect(accountLabels()).not.toContain("My bids");
  });

  it("shows a signed-in client their own pages in the same column", () => {
    session.user = { role: "client", staffRoles: [] };
    render(<SiteFooter />);
    expect(accountLabels()).toContain("My bids");
    expect(accountLabels()).not.toContain("Sign in");
  });

  it("leaves every other column the same whoever is signed in", () => {
    const others = () =>
      screen
        .getAllByRole("link")
        .map((link) => link.textContent)
        .filter((text) => !accountLabels().includes(text));
    const { unmount } = render(<SiteFooter />);
    const visitor = others();
    unmount();
    session.user = { role: "client", staffRoles: [] };
    render(<SiteFooter />);
    expect(others()).toEqual(visitor);
  });
});
