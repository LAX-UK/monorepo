import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { OverlayToneProvider } from "@/components/ui/overlay-tone-context";
import { DEFAULT_OVERLAY_TONE } from "@/hooks/use-image-overlay-tones";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SaleroomHeroToolbar", () => {
  it("exposes overlay tone tokens so toolbar links are visible on hero imagery", () => {
    render(
      <OverlayToneProvider
        value={{ tones: { contentBlock: DEFAULT_OVERLAY_TONE }, resolved: true }}
      >
        <SaleroomHeroToolbar shareUrl="https://example.com/sale" shareTitle="Evening Sale" />
      </OverlayToneProvider>,
    );

    const root = screen.getByRole("link", { name: /upcoming auctions/i }).parentElement;
    expect(root).toHaveAttribute("data-overlay-tone");
    expect(screen.getByRole("button", { name: /^share$/i }).className).toContain(
      "var(--overlay-fg)",
    );
    expect(screen.getByRole("button", { name: /print catalogue/i }).className).toContain(
      "var(--overlay-fg)",
    );
  });
});
