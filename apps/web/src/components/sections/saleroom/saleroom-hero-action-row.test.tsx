import { KYC_BID_BLOCKED_DESCRIPTION } from "@/components/kyc/kyc-copy";
import { SaleroomHeroActionRow } from "@/components/sections/saleroom/saleroom-hero-action-row";
import { OverlayToneProvider } from "@/components/ui/overlay-tone-context";
import { DEFAULT_OVERLAY_TONE } from "@/hooks/use-image-overlay-tones";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SaleHeroVM } from "./view-models";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/sections/saleroom/saleroom-follow-toggle", () => ({
  SaleroomFollowToggle: () => <button type="button">Follow</button>,
}));

const hero = {
  id: "sale-1",
  title: "Hybrid Day Sale",
  coverImage: null,
  dateLine: "Jun 19, 2026",
  itemsLabel: "12 lots",
  status: "active",
  isLive: true,
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString(),
  startEndLabel: "Jun 19 – Jun 20",
  registrationClosesLabel: null,
  biddingStartsLabel: null,
  description: null,
  shareUrl: "https://example.com/sales/test",
  tags: [],
  registrationClosesShort: null,
  biddingStartsShort: "Live now",
  leftColumnLabel: null,
  rightColumnLabel: "Bidding",
  overviewMetaLine: "Hybrid",
} satisfies SaleHeroVM;

describe("SaleroomHeroActionRow", () => {
  it("shows a single register CTA for guests on online sales", () => {
    render(
      <OverlayToneProvider
        value={{ tones: { contentBlock: DEFAULT_OVERLAY_TONE }, resolved: true }}
      >
        <SaleroomHeroActionRow
          hero={hero}
          isAuthenticated={false}
          deliveryMode="online"
          streamUrl={null}
          saleId="sale-1"
          saleHref="/sales/test/sale-1"
          initialFollowing={false}
          registerToBid={{
            show: true,
            buyerEntities: [],
            myRegistrations: [],
            kycApproved: false,
            orgModuleEnabled: true,
            saleCurrency: "GBP",
          }}
        />
      </OverlayToneProvider>,
    );

    expect(screen.getAllByRole("link", { name: /register to bid/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /register to bid/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("renders button band and caption below when KYC is not approved", () => {
    const { container } = render(
      <OverlayToneProvider
        value={{ tones: { contentBlock: DEFAULT_OVERLAY_TONE }, resolved: true }}
      >
        <SaleroomHeroActionRow
          hero={hero}
          isAuthenticated
          deliveryMode="hybrid"
          streamUrl={null}
          saleId="sale-1"
          saleHref="/sales/test/sale-1"
          initialFollowing={false}
          registerToBid={{
            show: true,
            buyerEntities: [],
            myRegistrations: [],
            kycApproved: false,
            kycFeedback: {
              headline: "Identity verification required",
              detail: KYC_BID_BLOCKED_DESCRIPTION,
              needsResubmit: false,
              action: "start",
              reasonCode: null,
              decisionStatus: null,
            },
            orgModuleEnabled: true,
            saleCurrency: "GBP",
          }}
        />
      </OverlayToneProvider>,
    );

    const root = container.firstElementChild as HTMLElement;
    const buttonBand = root.querySelector(":scope > div:first-child") as HTMLElement;
    const links = within(buttonBand).getAllByRole("link");
    expect(links[0]).toHaveTextContent(/browse lots/i);
    expect(within(buttonBand).getByRole("link", { name: /verify identity/i })).toBeInTheDocument();
    expect(within(buttonBand).getByRole("button", { name: /follow/i })).toBeInTheDocument();
    expect(within(buttonBand).queryByText(KYC_BID_BLOCKED_DESCRIPTION)).toBeNull();

    expect(screen.getByText(KYC_BID_BLOCKED_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(KYC_BID_BLOCKED_DESCRIPTION).className).toContain("var(--overlay-fg)");
  });
});
