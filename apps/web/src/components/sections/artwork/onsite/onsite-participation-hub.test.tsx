import { OnsiteParticipationHub } from "@/components/sections/artwork/onsite/onsite-participation-hub";
import type { OnsiteParticipationContext } from "@/lib/onsite/participation-request-input";
import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/sections/artwork/onsite/onsite-participation-forms", () => ({
  OnsiteAbsenteeBidForm: () => <div data-testid="absentee-form">Absentee form</div>,
  OnsiteTelephoneBidForm: () => <div data-testid="telephone-form">Telephone form</div>,
}));

vi.mock("@/components/sections/artwork/onsite/onsite-venue-drawer", () => ({
  OnsiteVenueDrawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const now = new Date("2026-06-01T12:00:00.000Z");

const baseSale: Sale = {
  id: "sale-x",
  title: "Evening Sale",
  description: null,
  coverImages: [],
  categoryId: null,
  deliveryMode: "onsite",
  streamUrl: null,
  locationName: "London Gallery",
  locationAddress: null,
  locationMapUrl: null,
  locationAddressLine1: "1 Test Street",
  locationAddressLine2: null,
  locationCity: "London",
  locationCounty: null,
  locationPostcode: "W1 1AA",
  locationCountry: "United Kingdom",
  status: "scheduled",
  startTime: new Date(now.getTime() + 86_400_000),
  endTime: new Date(now.getTime() + 172_800_000),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdAt: now,
  updatedAt: now,
};

const participationCtx: OnsiteParticipationContext = {
  saleTitle: baseSale.title,
  lotNumber: 1,
  lotTitle: "Study in Blue",
  lotUrl: "https://example.com/lot/1",
};

describe("OnsiteParticipationHub", () => {
  it("renders hub anchor and participation routes", () => {
    render(
      <OnsiteParticipationHub
        sale={baseSale}
        participationCtx={participationCtx}
        lotId="lot-1"
        loginNextPath="/lot/1"
        isAuthenticated={false}
        kycApproved={false}
        mobile={null}
        buyerEntities={[]}
      />,
    );

    expect(document.getElementById("bid-onsite-hub")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "In-Person Event Participation Hub" })).toBeTruthy();
    expect(screen.getByTestId("absentee-form")).toBeTruthy();
    expect(screen.getByTestId("telephone-form")).toBeTruthy();
    expect(screen.getByText("Live stream unavailable")).toBeTruthy();
  });

  it("links to live stream section when streamUrl is set", () => {
    const saleWithStream = { ...baseSale, streamUrl: "https://youtube.com/watch?v=abc" };
    render(
      <OnsiteParticipationHub
        sale={saleWithStream}
        participationCtx={participationCtx}
        lotId="lot-1"
        loginNextPath="/lot/1"
        isAuthenticated={false}
        kycApproved={false}
        mobile={null}
        buyerEntities={[]}
      />,
    );

    const streamLink = screen.getByRole("link", { name: /go to live stream/i });
    expect(streamLink).toHaveAttribute("href", "#live-stream");
  });
});
