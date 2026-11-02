import { BidEntryControls, type BidEntryHrefs } from "@/components/lot-page/bid/bid-entry-controls";
import { useViewerAnnouncements } from "@/components/lot-page/bid/use-viewer-announcements";
import { LotAnnouncerProvider } from "@/components/lot-page/lot-announcer";
import { type BidEntryInput, buildBidEntry } from "@auction/domain";
import type { LotPosition } from "@auction/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const hrefs: BidEntryHrefs = {
  sign_in: "/login?next=%2Flot%2Fx",
  register: "/sales/modern",
  client_services: "/contact",
  ask_admin: "/organisations",
};

const base: BidEntryInput = {
  action: "bid",
  lifecycle: "live",
  auctionType: "english",
  position: "none",
  nextBid: "7250.00",
  agentLimitLeft: null,
  premiumPercent: "25%",
  format: { money: (amount) => `£${Number(amount).toLocaleString("en-GB")}` },
};

function draw(over: Partial<BidEntryInput> = {}) {
  const onOpen = vi.fn();
  render(
    <BidEntryControls entry={buildBidEntry({ ...base, ...over })} hrefs={hrefs} onOpen={onOpen} />,
  );
  return onOpen;
}

describe("BidEntryControls", () => {
  it("eligible: the bid button opens the dialog on the next bid, a link opens it on a maximum", () => {
    const onOpen = draw();
    fireEvent.click(screen.getByRole("button", { name: "Bid £7,250" }));
    expect(onOpen).toHaveBeenLastCalledWith("next");
    fireEvent.click(screen.getByRole("button", { name: "Set a maximum bid" }));
    expect(onOpen).toHaveBeenLastCalledWith("maximum");
    expect(screen.getByText(/25% buyer's premium is added/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How bidding works" })).toHaveAttribute("href", "/faq");
  });

  it("signed out: a sign-in link that returns to the lot, and no bid button", () => {
    draw({ action: "sign_in" });
    expect(screen.getByRole("link", { name: "Sign in to bid" })).toHaveAttribute(
      "href",
      "/login?next=%2Flot%2Fx",
    );
    expect(screen.queryByRole("button", { name: /^bid/i })).toBeNull();
  });

  it("not registered: a link to register", () => {
    draw({ action: "register" });
    expect(screen.getByRole("link", { name: "Register to bid" })).toHaveAttribute(
      "href",
      "/sales/modern",
    );
  });

  it("registration pending: the button cannot be pressed and says why", () => {
    const onOpen = draw({ action: "registration_pending" });
    const button = screen.getByRole("button", { name: "Bid £7,250" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("You can bid once your registration is approved.")).toBeVisible();
    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("an agent whose limit cannot cover the bid: disabled, with a link to ask an admin", () => {
    draw({ agentLimitLeft: "5000.00" });
    expect(screen.getByRole("button", { name: "Bid £7,250" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Ask an organisation admin to raise your limit.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ask an admin" })).toHaveAttribute(
      "href",
      "/organisations",
    );
  });

  it("leading: a quieter way to set a maximum, no second bid button", () => {
    draw({ position: "leading" });
    expect(screen.queryByRole("button", { name: "Bid £7,250" })).toBeNull();
    expect(screen.getByRole("button", { name: "Set a maximum bid" })).toBeInTheDocument();
  });

  it("the sale paused: the bid button says it resumes with the auctioneer", () => {
    draw({ action: "bid_disabled" });
    expect(screen.getByRole("button", { name: "Bid £7,250" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByText("Bidding resumes when the auctioneer restarts the sale."),
    ).toBeVisible();
  });
});

function Watcher({ position }: { position: LotPosition }) {
  useViewerAnnouncements({
    position,
    lotTitle: "Estuary, evening",
    currentPrice: "7250.00",
    nextBid: "7500.00",
  });
  return null;
}

describe("viewer announcements", () => {
  it("says nothing on load, then announces being outbid in the polite live region", () => {
    const { rerender } = render(
      <LotAnnouncerProvider>
        <Watcher position="leading" />
      </LotAnnouncerProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("");
    rerender(
      <LotAnnouncerProvider>
        <Watcher position="outbid" />
      </LotAnnouncerProvider>,
    );
    expect(region).toHaveTextContent(
      "You've been outbid on Estuary, evening. The next bid is £7,500.",
    );
  });

  it("announces taking the lead", () => {
    const { rerender } = render(
      <LotAnnouncerProvider>
        <Watcher position="none" />
      </LotAnnouncerProvider>,
    );
    rerender(
      <LotAnnouncerProvider>
        <Watcher position="leading" />
      </LotAnnouncerProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("You're the highest bidder at £7,250.");
  });
});
