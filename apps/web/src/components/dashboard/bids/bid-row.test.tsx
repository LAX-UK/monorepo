// The device is in London: a visitor elsewhere has chosen their zone.
process.env.TZ = "Europe/London";

import type { MyBidCardVm } from "@/lib/bid/my-bids.vm";
import { renderAsVisitorIn, setViewerZone } from "@/test/viewer-zone";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { BidRow } from "./bid-row";

const CLOSES = { iso: "2026-11-12T18:00:00.000Z", zone: "Europe/London" };

function card(over: Partial<MyBidCardVm> = {}): MyBidCardVm {
  return {
    id: "b1",
    lotId: "l1",
    href: "/lots/l1",
    image: null,
    title: "Harbour Light",
    lotLabel: "Lot 14",
    saleId: "s1",
    saleTitle: "Winter Evening Sale",
    placedBy: null,
    placementNote: null,
    status: "winning",
    statusLabel: "Winning",
    figures: [{ label: "closes", value: "Thu 12 Nov" }],
    closes: CLOSES,
    next: null,
    more: [],
    closesAt: 0,
    amount: 0,
    ...over,
  };
}

const row = (c: MyBidCardVm) => <BidRow card={c} onOpenHistory={vi.fn()} bidBlockedReason={null} />;

afterEach(() => setViewerZone(null));

describe("BidRow's own-time text", () => {
  it("adds the close in the visitor's time as plain text, not a button", () => {
    renderAsVisitorIn("Africa/Cairo", row(card()));
    expect(screen.getByText("20:00")).toBeInTheDocument();
    expect(screen.getByText(/Your time:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
  });

  it("names the day when the visitor's day differs", () => {
    renderAsVisitorIn("Australia/Sydney", row(card()));
    expect(screen.getByText("Fri 13 Nov")).toBeInTheDocument();
  });

  it.each(["Europe/London", "UTC", null])("adds nothing for %s", (zone) => {
    const { container } = renderAsVisitorIn(zone, row(card()));
    expect(container.querySelector("time")).toBeNull();
  });

  it("adds nothing to a row with no close to quote", () => {
    const { container } = renderAsVisitorIn("Africa/Cairo", row(card({ closes: null })));
    expect(container.querySelector("time")).toBeNull();
  });
});
