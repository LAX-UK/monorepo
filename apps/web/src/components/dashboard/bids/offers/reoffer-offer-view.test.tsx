import {
  type BidderReofferViewer,
  bidderReofferRows,
  bidderReofferVm,
} from "@/lib/reoffer/bidder-reoffer.vm";
import type { BidderReofferView } from "@auction/validators";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/bidder-reoffer", () => ({
  acceptBidderReofferAction: vi.fn(),
  declineBidderReofferAction: vi.fn(),
}));
vi.mock("@/components/ui/media-image", () => ({ MediaImage: () => null }));

import { ReofferOfferRows } from "./reoffer-offer-rows";
import { ReofferOfferView } from "./reoffer-offer-view";

const NOW = new Date("2026-11-12T10:00:00Z");
const view = (over: Partial<BidderReofferView> = {}): BidderReofferView => ({
  id: "o1",
  lotId: "lot1",
  lotTitle: "The Winter Study",
  lotNumber: 2,
  saleId: null,
  lotImage: null,
  lotEndedAt: "2026-10-29T17:00:00.000Z",
  status: "offered",
  price: {
    hammerMinor: 82_000_00,
    buyersPremiumMinor: 20_500_00,
    vatOnPremiumMinor: 4_100_00,
    vatOnLotMinor: null,
    artistsResaleRightMinor: null,
    totalMinor: 106_600_00,
  },
  endsAt: "2026-11-14T17:00:00.000Z",
  respondedAt: null,
  invoiceDueAt: null,
  ...over,
});
const viewer: BidderReofferViewer = {
  canAnswer: true,
  organisation: null,
  identityCheckPending: false,
  endedWhileAnswering: false,
  saleTitle: null,
};
const show = (over: Partial<BidderReofferView>, who = viewer) =>
  render(<ReofferOfferView vm={bidderReofferVm(view(over), who, NOW)} />);

describe("ReofferOfferView", () => {
  it("shows an open offer with the price, the terms box and both answers", () => {
    show({});
    expect(screen.getByRole("heading", { level: 1, name: "An offer for you" })).toBeTruthy();
    expect(screen.getByText("Ends Sat 14 Nov, 17:00 GMT")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("£106,600.00")).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept and continue" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("shows no answers to a member who may not answer, and says who can", () => {
    show({}, { ...viewer, canAnswer: false, organisation: "Northbank Gallery" });
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept and continue" })).toBeNull();
    expect(
      screen.getByText("Only members who can bid for Northbank Gallery can answer"),
    ).toBeTruthy();
  });

  it("shows an ended offer without answers, still with the price, and a way to the sales", () => {
    show({ status: "ended" });
    expect(screen.getByRole("heading", { name: "This offer has ended" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("£106,600.00")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse upcoming sales" })).toBeTruthy();
  });

  it("says so in danger when the offer ended while the person was answering", () => {
    show({ status: "ended" }, { ...viewer, endedWhileAnswering: true });
    expect(
      screen.getByText("It can no longer be accepted. Nothing has been charged."),
    ).toBeTruthy();
  });

  it("leads an accepted offer to the purchase, where Pay is ready", () => {
    show({ status: "accepted", respondedAt: "2026-11-12T09:00:00.000Z" });
    expect(screen.getByRole("link", { name: "View your purchase" }).getAttribute("href")).toBe(
      "/purchases/lot1",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("ReofferOfferRows", () => {
  it("pins each open offer above the bids with its price and the way to answer", () => {
    render(<ReofferOfferRows rows={bidderReofferRows([view()], NOW)} />);
    expect(screen.getByRole("heading", { name: /Offers for you/ })).toBeTruthy();
    expect(screen.getByText("£82,000.00")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toBe("/bids/offers/o1");
    expect(screen.getByText("Review the offer")).toBeTruthy();
  });

  it("is not there at all when nothing waits", () => {
    const { container } = render(<ReofferOfferRows rows={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
