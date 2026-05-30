import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/layout/header-auth-chip", () => ({
  MobileAuthSection: () => null,
}));

vi.mock("@/components/layout/header-search", () => ({
  HeaderSearchPaletteTrigger: () => null,
}));

vi.mock("@/components/layout/lax-logo", () => ({
  LaxLogo: () => <span>LAX</span>,
}));

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

describe("MobileNavDrawer", () => {
  it("leaves a tappable backdrop strip and exposes an in-drawer close control", () => {
    render(
      <MobileNavDrawer
        open
        onOpenChange={() => {}}
        pathname="/"
        searchParams={null}
        sections={emptyMegaMenuSections()}
      />,
    );

    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
    const panel = document.querySelector("[data-state='open'][role='dialog']");
    expect(panel?.className).toMatch(/min\(100vw-3rem/);
  });
});
