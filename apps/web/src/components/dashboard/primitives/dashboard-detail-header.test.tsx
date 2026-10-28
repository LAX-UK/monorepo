import { createTokenContrast } from "@/test/css-token-contrast";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardDetailHeader } from "./dashboard-detail-header";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("DashboardDetailHeader back link and eyebrow", () => {
  it("uses the neutral treatment for the back link and the eyebrow", () => {
    render(
      <DashboardDetailHeader
        eyebrow="Consignment"
        backHref="/selling/consignments"
        backLabel="Consignments"
        title="Blue study"
      />,
    );
    const link = screen.getByRole("link", { name: "Consignments" });
    expect(link).toHaveAttribute("href", "/selling/consignments");
    expect(link.className).toContain("text-on-surface-variant");
    expect(link.className).toContain("hover:text-on-surface");
    const eyebrow = screen.getByText("Consignment");
    for (const el of [link, eyebrow]) {
      expect(el.className).not.toMatch(/lot-orange|live-red|accent-buying|text-link|uppercase/);
    }
    expect(eyebrow).toHaveClass("text-on-surface-variant", "text-xs");
  });

  it("passes 4.5:1 on the page and on the header in light and dark", () => {
    const contrast = createTokenContrast();
    // The orange it replaces measured 3.2:1 on white.
    expect(contrast("lot-orange", "surface", "light")).toBeCloseTo(3.19, 1);
    for (const theme of ["light", "dark"] as const) {
      for (const bg of ["surface", "shell-page-bg"]) {
        expect(contrast("on-surface-variant", bg, theme)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
