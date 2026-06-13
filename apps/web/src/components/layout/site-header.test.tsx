import { SiteHeader } from "@/components/layout/site-header";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: null, pending: false }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/layout/header-mega-nav", () => ({
  HeaderMegaNav: ({
    logo,
    trailing,
  }: {
    logo: React.ReactNode;
    trailing: React.ReactNode;
  }) => (
    <nav aria-label="Primary">
      {logo}
      {trailing}
    </nav>
  ),
}));

vi.mock("@/components/layout/header-utility-bar", () => ({
  HeaderUtilityBar: () => null,
}));

vi.mock("@/components/layout/header-search", () => ({
  HeaderSearchTrigger: () => null,
}));

vi.mock("@/components/layout/header-auth-chip", () => ({
  HeaderAuthChip: () => null,
}));

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Switch to dark theme</button>,
}));

vi.mock("@/components/layout/mobile-nav-drawer", () => ({
  MobileNavDrawer: () => null,
}));

vi.mock("@/components/marketing/chrome-icon-button", () => ({
  ChromeIconButton: () => null,
}));

describe("SiteHeader", () => {
  it("renders primary wordmark with light/dark assets in the header logo link", () => {
    render(<SiteHeader />);

    const logos = screen.getAllByRole("img", { hidden: true, name: /London Auction House/i });
    expect(logos.some((img) => img.getAttribute("src") === "/logo.svg")).toBe(true);
    expect(logos.some((img) => img.getAttribute("src") === "/logo-light.svg")).toBe(true);

    const logoLink = logos
      .find((img) => img.getAttribute("src") === "/logo.svg")
      ?.closest(".site-header-logo");
    expect(logoLink).not.toBeNull();

    const eagerLogos = logos.filter((img) => img.getAttribute("loading") === "eager");
    expect(eagerLogos.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps theme toggle out of the mobile header bar", () => {
    render(<SiteHeader />);

    const themeToggle = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(themeToggle.closest(".hidden")).not.toBeNull();
  });
});
