import { KYC_BID_BLOCKED_DESCRIPTION } from "@/components/kyc/kyc-copy";
import { SaleroomHeroActionRow } from "@/components/sections/saleroom/saleroom-hero-action-row";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SaleHeroVM } from "./view-models";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/sections/saleroom/saleroom-follow-toggle", () => ({
  SaleroomFollowToggle: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Follow"}</button>
  ),
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
  shareUrl: "https://example.com/sales/test",
  registrationClosesShort: null,
  biddingStartsShort: null,
  leftColumnLabel: null,
  rightColumnLabel: null,
  deliveryMode: "online",
} satisfies SaleHeroVM;

describe("SaleroomHeroActionRow", () => {
  it("shows a single register CTA for guests on online sales", () => {
    render(
      <SaleroomHeroActionRow
        hero={hero}
        isAuthenticated={false}
        deliveryMode="online"
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
      />,
    );

    expect(screen.getAllByRole("link", { name: /register to bid/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /register to bid/i })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByRole("link", { name: /browse lots/i })).not.toBeInTheDocument();
  });

  it("renders Notify me in a separate footer band from register CTAs", () => {
    render(
      <SaleroomHeroActionRow
        hero={hero}
        isAuthenticated
        deliveryMode="hybrid"
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
      />,
    );

    const verifyLink = screen.getByRole("link", { name: /verify to continue bidding/i });
    const primaryBand = verifyLink.closest("div");
    expect(primaryBand).toBeTruthy();
    if (!primaryBand) return;
    expect(within(primaryBand).queryByRole("button", { name: /notify me/i })).toBeNull();
    expect(within(primaryBand).queryByRole("link", { name: /browse lots/i })).toBeNull();

    expect(screen.getByRole("button", { name: /notify me/i })).toBeInTheDocument();
    expect(screen.getByText(KYC_BID_BLOCKED_DESCRIPTION).className).toContain(
      "text-on-surface-variant",
    );
  });
});
