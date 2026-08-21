import { KYC_BID_BLOCKED_DESCRIPTION } from "@/components/kyc/kyc-copy";
import {
  SaleroomRegisterToBid,
  registerToBidHeroCaption,
  registerToBidNeedsAgentFormBand,
} from "@/components/sections/saleroom/saleroom-register-to-bid";
import { OverlayToneProvider } from "@/components/ui/overlay-tone-context";
import { DEFAULT_OVERLAY_TONE } from "@/hooks/use-image-overlay-tones";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const baseProps = {
  saleId: "sale-1",
  loginNextPath: "/sales/test/sale-1",
  isAuthenticated: true,
  show: true,
  buyerEntities: [],
  myRegistrations: [],
  kycApproved: false,
  kycFeedback: {
    headline: "Identity verification required",
    detail: KYC_BID_BLOCKED_DESCRIPTION,
    needsResubmit: false,
    action: "start" as const,
    reasonCode: null,
    decisionStatus: null,
  },
};

describe("registerToBidHeroCaption", () => {
  it("returns KYC detail when bidding is blocked", () => {
    expect(registerToBidHeroCaption(baseProps)).toBe(KYC_BID_BLOCKED_DESCRIPTION);
  });

  it("returns null when KYC is approved", () => {
    expect(registerToBidHeroCaption({ ...baseProps, kycApproved: true })).toBeNull();
  });
});

describe("registerToBidNeedsAgentFormBand", () => {
  it("returns true when agent entities exist and KYC is approved", () => {
    expect(
      registerToBidNeedsAgentFormBand({
        ...baseProps,
        kycApproved: true,
        buyerEntities: [{ id: "le-1", displayName: "Agency", memberRole: "buyer_agent" as const }],
      }),
    ).toBe(true);
  });

  it("returns false when no agent entities", () => {
    expect(registerToBidNeedsAgentFormBand({ ...baseProps, kycApproved: true })).toBe(false);
  });
});

describe("SaleroomRegisterToBid", () => {
  it("layout=button renders verify link without caption wrapper", () => {
    render(
      <OverlayToneProvider
        value={{ tones: { contentBlock: DEFAULT_OVERLAY_TONE }, resolved: true }}
      >
        <SaleroomRegisterToBid {...baseProps} layout="button" />
      </OverlayToneProvider>,
    );

    expect(screen.queryByText(KYC_BID_BLOCKED_DESCRIPTION)).toBeNull();
    expect(screen.getByRole("link", { name: /verify to continue bidding/i })).toBeInTheDocument();
  });

  it("uses overlay-tone copy for KYC detail in default layout when inside overlay frame", () => {
    render(
      <OverlayToneProvider
        value={{ tones: { contentBlock: DEFAULT_OVERLAY_TONE }, resolved: true }}
      >
        <SaleroomRegisterToBid {...baseProps} layout="default" />
      </OverlayToneProvider>,
    );

    const detail = screen.getByText(KYC_BID_BLOCKED_DESCRIPTION);
    expect(detail.className).toContain("var(--overlay-fg)");
    expect(detail.className).not.toContain("text-secondary");
  });

  it("uses surface tokens for KYC detail in default layout outside overlay frame", () => {
    render(<SaleroomRegisterToBid {...baseProps} layout="default" />);

    const detail = screen.getByText(KYC_BID_BLOCKED_DESCRIPTION);
    expect(detail.className).toContain("text-on-surface-variant");
    expect(detail.className).not.toContain("var(--overlay-fg)");
  });
});
