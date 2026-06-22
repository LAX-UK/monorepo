import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SaleroomHeroToolbar", () => {
  it("renders share only with minimum touch target", () => {
    render(<SaleroomHeroToolbar shareUrl="https://example.com/sale" shareTitle="Evening Sale" />);

    const share = screen.getByRole("button", { name: /^share$/i });
    expect(share.className).toContain("min-h-11");
    expect(share.className).toContain("text-on-surface-variant");
    expect(screen.getByRole("navigation", { name: /sale actions/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /upcoming auctions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add to calendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /print catalogue/i })).not.toBeInTheDocument();
  });
});
