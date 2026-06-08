import type {
  AccordionBlock,
  AuctionSessionHeaderVM,
  LotQueueCardVM,
  LotRelatedRailVM,
} from "@/components/sections/artwork/artwork-view-models";
import { ArtworkOnlineLayout } from "@/components/sections/artwork/layouts/artwork-online-layout";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auction = {
  id: "lot-1",
  title: "Test Lot",
  status: "active",
  startTime: new Date("2026-05-01"),
  endTime: new Date("2026-05-02"),
  images: [],
  currentPrice: "100",
  sellerId: "seller-1",
  marketingDetails: { imageAlts: [] },
} as unknown as Lot;

const queueCard = (id: string): LotQueueCardVM => ({
  id,
  href: `/lot/x/${id}`,
  imageUrl: null,
  lotNumber: 1,
  title: `Lot ${id}`,
  artistName: "Artist",
  estimateLine: null,
  currentBid: "£100",
  isCurrentLot: id === "lot-1",
  isUpNext: false,
});

const sessionHeader: AuctionSessionHeaderVM = {
  saleTitle: "Test Sale",
  lotLabel: "Lot 1",
  paddleNumber: null,
  userVerified: false,
};

const rail: LotRelatedRailVM = {
  mode: "seller",
  heading: "More from seller",
  viewAuctionHref: null,
  cards: [],
};

const blocks: AccordionBlock[] = [];

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderLayout(props: ComponentProps<typeof ArtworkOnlineLayout>) {
  return render(
    <LotPortsProvider>
      <ArtworkOnlineLayout {...props} />
    </LotPortsProvider>,
  );
}

describe("ArtworkOnlineLayout", () => {
  it("uses a 2-column grid when the queue sidebar is hidden", () => {
    const { container } = renderLayout({
      auction,
      saleForLifecycle: { status: "active", deliveryMode: "online" },
      sessionHeader,
      queueCurrent: queueCard("lot-1"),
      queueUpNext: null,
      queueRest: [],
      marketingAccordionBlocks: blocks,
      rail,
      isAuthenticated: false,
      watchedLotIds: [],
      currentUserId: null,
      shareUrl: "https://example.com/lot",
      followSlot: <span>Follow</span>,
      bidPanel: <div>Bid panel</div>,
    });

    const grid = container.querySelector(
      ".lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_minmax\\(0\\,440px\\)\\]",
    );
    expect(grid).toBeTruthy();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("uses a 3-column grid when queue siblings exist", () => {
    const { container } = renderLayout({
      auction,
      saleForLifecycle: { status: "active", deliveryMode: "online" },
      sessionHeader,
      queueCurrent: queueCard("lot-1"),
      queueUpNext: queueCard("lot-2"),
      queueRest: [],
      marketingAccordionBlocks: blocks,
      rail,
      isAuthenticated: false,
      watchedLotIds: [],
      currentUserId: null,
      shareUrl: "https://example.com/lot",
      followSlot: <span>Follow</span>,
      bidPanel: <div>Bid panel</div>,
    });

    const grid = container.querySelector(
      ".lg\\:grid-cols-\\[minmax\\(0\\,280px\\)_minmax\\(0\\,1fr\\)_minmax\\(0\\,400px\\)\\]",
    );
    expect(grid).toBeTruthy();
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });
});
