import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { OverlayToneProvider } from "@/components/ui/overlay-tone-context";
import { DEFAULT_OVERLAY_TONE } from "@/hooks/use-image-overlay-tones";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SaleroomFollowToggle", () => {
  it("uses overlay-tone chrome for outlined-block hero when inside AdaptiveMediaFrame", () => {
    render(
      <OverlayToneProvider
        value={{ tones: { contentBlock: DEFAULT_OVERLAY_TONE }, resolved: true }}
      >
        <SaleroomFollowToggle
          saleId="sale-1"
          initialFollowing={false}
          isAuthenticated={false}
          loginNextPath="/sales/test/sale-1"
          appearance="outlined-block"
          label="Follow"
        />
      </OverlayToneProvider>,
    );

    const link = screen.getByRole("link", { name: /follow/i });
    expect(link).toHaveAttribute("data-overlay-tone");
    expect(link.className).toContain("var(--overlay-fg)");
    expect(link.className).not.toContain("text-brand-800");
  });

  it("keeps on-surface styling for outlined-block outside an overlay frame", () => {
    render(
      <SaleroomFollowToggle
        saleId="sale-1"
        initialFollowing={false}
        isAuthenticated={false}
        loginNextPath="/sales/test/sale-1"
        appearance="outlined-block"
        label="Follow"
      />,
    );

    const link = screen.getByRole("link", { name: /follow/i });
    expect(link).not.toHaveAttribute("data-overlay-tone");
    expect(link.className).toContain("text-brand-800");
  });
});
