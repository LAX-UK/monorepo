import { SaleMobileSummaryBarIsland } from "@/components/sections/saleroom/saleroom-viewer-islands";
import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import { MarketingBottomTabBar } from "@auction/marketing-ui/marketing-bottom-tab-bar";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Viewer = {
  canParticipateAsBuyer: boolean;
  myRegistrations: { status: string }[];
  kycApproved: boolean;
};
let viewer: Viewer;

vi.mock("@/components/sections/saleroom/sale-viewer-provider", () => ({
  useSaleViewer: () => viewer,
}));
vi.mock("@/hooks/use-sale-phone-bar-visible", () => ({ useSalePhoneBarVisible: () => true }));
vi.mock("@/lib/context/saleroom-live-provider", () => ({ useSaleroomLive: () => null }));
vi.mock("@/lib/sale/use-active-sale-countdown-end-iso", () => ({
  useActiveSaleCountdownEndIso: () => null,
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

function bar() {
  render(
    <>
      <CookieDock />
      <MarketingBottomTabBar
        tabs={[{ key: "home", label: "Home", icon: null, href: "/", paths: ["/"] }]}
        pathname="/sales/spring"
        onSearch={() => {}}
      />
      <SaleMobileSummaryBarIsland
        start={new Date("2026-11-18T10:00:00Z")}
        end={new Date("2026-11-20T18:00:00Z")}
        status="scheduled"
        saleTitle="Spring sale"
        atgReadOnly={false}
      />
    </>,
  );
}

// The sale page's bottom bar follows the same registration state as the hero, whatever the
// KYC or account-review state: only an approved registration retires "Register".
describe("sale bottom bar follows the registration state", () => {
  beforeEach(() => {
    viewer = { canParticipateAsBuyer: true, myRegistrations: [], kycApproved: true };
  });

  it.each([
    ["not registered, KYC approved", [], true, "Register"],
    ["not registered, KYC pending", [], false, "Register"],
    ["registration pending, KYC pending", [{ status: "pending" }], false, "Register"],
    ["registration pending, KYC approved", [{ status: "pending" }], true, "Register"],
    ["registration approved, KYC approved", [{ status: "approved" }], true, "View lots"],
    ["registration approved, KYC pending", [{ status: "approved" }], false, "View lots"],
  ])("$0 shows $3", (_name, myRegistrations, kycApproved, label) => {
    viewer = { canParticipateAsBuyer: true, myRegistrations, kycApproved };
    bar();
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  });
});
