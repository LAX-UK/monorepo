import { SiteHeader } from "@/components/layout/site-header";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  it("renders a single logo.svg mark for all breakpoints", () => {
    render(<SiteHeader />);

    const logos = screen.getAllByRole("img", { name: /London Auction House/i });
    expect(logos).toHaveLength(1);
    expect(logos[0]).toHaveAttribute("src", "/logo.svg");
    expect(logos[0]).toHaveAttribute("loading", "eager");
  });

  it("keeps theme toggle out of the mobile header bar", () => {
    render(<SiteHeader />);

    const themeToggle = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(themeToggle.closest(".hidden")).not.toBeNull();
  });
});
