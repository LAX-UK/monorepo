import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Lot } from "@auction/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mergeLotQuickLookEnrichment } from "./fetch-lot-quick-look-enrichment.client";
import { LotQuickLookProvider } from "./lot-quick-look-context";
import { LotQuickLookDialog } from "./lot-quick-look-dialog";
import { lotQuickLookEnrichmentFromLot } from "./lot-quick-look-enrichment";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import { lotQuickLookFromLotCardVM, lotQuickLookRailDeck } from "./mappers";
import { type LotQuickLookVM, isLotQuickLookBiddable } from "./types";

vi.mock("./fetch-lot-quick-look-enrichment.client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fetch-lot-quick-look-enrichment.client")>();
  return {
    ...actual,
    fetchLotQuickLookEnrichment: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("./lot-quick-look-lightbox", () => ({
  LotQuickLookLightbox: () => null,
}));

vi.mock("./lot-quick-look-analytics", () => ({
  emitQuickLookOpen: vi.fn(),
  emitQuickLookDeckNav: vi.fn(),
  emitQuickLookCta: vi.fn(),
}));

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: vi.fn(() => false),
}));

afterEach(() => {
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

vi.mock("@/components/marketing/lot-status-badge", () => ({
  LotStatusTimer: ({ layout }: { layout?: string }) => (
    <span data-testid="lot-status-timer" data-layout={layout ?? "overlay"} />
  ),
}));

vi.mock("@/components/marketing/watchlist-heart-button", () => ({
  MarketingWatchlistHeart: () => <button type="button">Watchlist</button>,
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt?: string }) => <div data-testid="media-image" aria-label={alt} />,
}));

const lotCardVm: LotCardVM = {
  id: "lot-1",
  href: "/lot/test-lot",
  title: "Blue Horizon",
  artistName: "Jane Artist",
  imageUrl: "https://example.com/a.jpg",
  imageAlt: "Blue Horizon",
  status: "active",
  startTime: "2026-01-01T00:00:00.000Z",
  endTime: "2026-01-02T00:00:00.000Z",
  lotLabel: "LOT 12",
  sellerId: "seller-1",
  priceLabel: "Estimate",
  priceFormatted: "$1,000 – $2,000",
  priceEmphasis: "estimate",
};

function baseLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-enrich",
    saleId: "sale-1",
    lotNumber: 12,
    title: "Blue Horizon",
    description: null,
    medium: "Oil on canvas",
    dimensions: "180 x 140 cm",
    images: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "900.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "50.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date("2026-01-01T00:00:00.000Z"),
    endTime: new Date("2026-01-02T00:00:00.000Z"),
    status: "active",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

function visibleQuickLookHeading(name: string) {
  const dialog = screen.getByRole("dialog");
  return within(dialog)
    .getAllByRole("heading", { name })
    .find((node) => !node.classList.contains("sr-only"));
}

function QuickLookHarness({
  vm,
  deck,
  deckIndex,
  deckSourceLabel,
}: {
  vm: LotQuickLookVM;
  deck?: LotQuickLookVM[];
  deckIndex?: number;
  deckSourceLabel?: string;
}) {
  return (
    <LotQuickLookProvider>
      <LotQuickLookTrigger
        vm={vm}
        options={{
          isAuthenticated: true,
          watchedLotIds: [],
          loginNextPath: vm.href,
          ...(deck ? { deck, deckIndex: deckIndex ?? 0 } : {}),
          ...(deckSourceLabel ? { deckSourceLabel } : {}),
        }}
      />
      <LotQuickLookDialog />
    </LotQuickLookProvider>
  );
}

describe("lotQuickLook mappers", () => {
  it("maps LotCardVM fields to LotQuickLookVM", () => {
    const vm = lotQuickLookFromLotCardVM({
      ...lotCardVm,
      endingSoonPriceRows: {
        estimate: { label: "Estimate", value: "$1k – $2k" },
        current: { label: "Current bid", value: "$900" },
      },
    });
    expect(vm.id).toBe("lot-1");
    expect(vm.title).toBe("Blue Horizon");
    expect(vm.subtitle).toBe("Jane Artist");
    expect(vm.estimateValue).toBe("$1k – $2k");
    expect(vm.currentBidValue).toBe("$900");
  });

  it("builds a rail deck with one VM per card", () => {
    const deck = lotQuickLookRailDeck([
      {
        id: "a",
        href: "/lot/a",
        imageUrl: null,
        lotNumber: 1,
        title: "A",
        artistOrSellerName: "Artist",
        estimateLine: "$100",
        currentPrice: "$50",
        endTime: new Date("2026-01-02"),
        status: "active",
        sellerId: "s1",
      },
      {
        id: "b",
        href: "/lot/b",
        imageUrl: null,
        lotNumber: 2,
        title: "B",
        artistOrSellerName: "Artist",
        estimateLine: null,
        currentPrice: "$75",
        endTime: new Date("2026-01-03"),
        status: "scheduled",
        sellerId: "s2",
      },
    ]);
    expect(deck).toHaveLength(2);
    expect(deck[0]?.title).toBe("A");
    expect(deck[1]?.lotLabel).toBe("LOT 2");
  });
});

describe("lotQuickLookEnrichmentFromLot", () => {
  it("returns current bid, dimensions, min next bid, and buyer premium for active lots", () => {
    const enrichment = lotQuickLookEnrichmentFromLot(baseLot());
    expect(enrichment.dimensions).toBe("180 x 140 cm");
    expect(enrichment.currentBidLabel).toBeTruthy();
    expect(enrichment.currentBidValue).toBeTruthy();
    expect(enrichment.minNextBidLabel).toBe("Min. next bid");
    expect(enrichment.minNextBidValue).toBeTruthy();
    expect(enrichment.buyersPremiumHint).toBe("Buyer's premium 25%");
    expect(enrichment.images).toHaveLength(2);
  });

  it("omits min next bid for ended lots", () => {
    const enrichment = lotQuickLookEnrichmentFromLot(baseLot({ status: "ended" }));
    expect(enrichment.minNextBidLabel).toBeUndefined();
  });
});

describe("isLotQuickLookBiddable", () => {
  it("allows bid CTA only for active lots", () => {
    expect(isLotQuickLookBiddable("active")).toBe(true);
    expect(isLotQuickLookBiddable("scheduled")).toBe(false);
    expect(isLotQuickLookBiddable("ended")).toBe(false);
  });
});

describe("mergeLotQuickLookEnrichment", () => {
  it("fills missing estimate and medium from enrichment", () => {
    const base = lotQuickLookFromLotCardVM(lotCardVm);
    const merged = mergeLotQuickLookEnrichment(base, {
      medium: "Oil on canvas",
      estimateValue: "$1,500 – $2,500",
      estimateLabel: "Estimate",
      status: "active",
    });
    expect(merged.medium).toBe("Oil on canvas");
    expect(merged.estimateValue).toBe("$1,000 – $2,000");
    expect(merged.status).toBe("active");
  });

  it("merges current bid, dimensions, and min next bid from enrichment", () => {
    const base = lotQuickLookFromLotCardVM(lotCardVm);
    const merged = mergeLotQuickLookEnrichment(base, {
      currentBidLabel: "Current bid",
      currentBidValue: "$950",
      dimensions: "180 x 140 cm",
      minNextBidLabel: "Min. next bid",
      minNextBidValue: "$1,000",
      buyersPremiumHint: "Buyer's premium 25%",
      status: "active",
    });
    expect(merged.currentBidValue).toBe("$950");
    expect(merged.dimensions).toBe("180 x 140 cm");
    expect(merged.minNextBidValue).toBe("$1,000");
    expect(merged.buyersPremiumHint).toBe("Buyer's premium 25%");
  });
});

describe("LotQuickLookTrigger", () => {
  it("opens the dialog with the lot title", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);

    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(visibleQuickLookHeading("Blue Horizon")).toBeTruthy();
    expect(screen.getByRole("link", { name: /view lot/i })).toHaveAttribute(
      "href",
      "/lot/test-lot",
    );
  });

  it("shows Bid as primary CTA for active lots", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    await screen.findByRole("dialog");
    expect(screen.getByRole("link", { name: /^bid$/i })).toBeInTheDocument();
  });

  it("hides Bid CTA for ended lots", async () => {
    const vm = lotQuickLookFromLotCardVM({ ...lotCardVm, status: "ended" });
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("link", { name: /^bid$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view lot/i })).toBeInTheDocument();
  });

  it("shows deck source label when provided", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} deckSourceLabel="More from this sale" />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    expect(await screen.findByText("More from this sale")).toBeInTheDocument();
  });

  it("applies panel motion classes when reduced motion is off", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
    expect(dialog.className).toMatch(/zoom-in-95/);
  });

  it("navigates deck with arrow keys when lot has a single image", async () => {
    const deck = lotQuickLookRailDeck([
      {
        id: "a",
        href: "/lot/a",
        imageUrl: null,
        lotNumber: 1,
        title: "Lot Alpha",
        artistOrSellerName: "Artist",
        estimateLine: "$100",
        currentPrice: "$50",
        endTime: new Date("2026-01-02"),
        status: "active",
        sellerId: "s1",
      },
      {
        id: "b",
        href: "/lot/b",
        imageUrl: null,
        lotNumber: 2,
        title: "Lot Beta",
        artistOrSellerName: "Artist",
        estimateLine: null,
        currentPrice: "$75",
        endTime: new Date("2026-01-03"),
        status: "scheduled",
        sellerId: "s2",
      },
    ]);
    const firstCard = deck[0];
    if (firstCard === undefined) {
      throw new Error("Expected deck to contain at least one card");
    }
    render(<QuickLookHarness vm={firstCard} deck={deck} deckIndex={0} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at lot alpha/i }));
    await screen.findByRole("dialog");
    expect(visibleQuickLookHeading("Lot Alpha")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("dialog");
    expect(visibleQuickLookHeading("Lot Beta")).toBeTruthy();
  });

  it("navigates deck with Shift+Arrow when lot has multiple images", async () => {
    const vm: LotQuickLookVM = {
      id: "multi",
      href: "/lot/multi",
      title: "Multi Image Lot",
      subtitle: "Artist",
      imageUrl: "https://example.com/1.jpg",
      imageAlt: "Multi",
      status: "active",
      startTime: "2026-01-01T00:00:00.000Z",
      endTime: "2026-01-02T00:00:00.000Z",
      images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    };
    const deck: LotQuickLookVM[] = [
      vm,
      {
        ...vm,
        id: "second",
        title: "Second Lot",
        images: ["https://example.com/3.jpg"],
        imageUrl: "https://example.com/3.jpg",
      },
    ];
    render(<QuickLookHarness vm={vm} deck={deck} deckIndex={0} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at multi image lot/i }));
    await screen.findByRole("dialog");
    expect(visibleQuickLookHeading("Multi Image Lot")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(visibleQuickLookHeading("Multi Image Lot")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    await screen.findByRole("dialog");
    expect(visibleQuickLookHeading("Second Lot")).toBeTruthy();
  });
});

describe("LotQuickLookDialog layout", () => {
  it("uses inline layout for the status timer", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    await screen.findByRole("dialog");
    expect(screen.getByTestId("lot-status-timer")).toHaveAttribute("data-layout", "inline");
  });

  it("renders pricing rows in bordered card cells", async () => {
    const vm = lotQuickLookFromLotCardVM({
      ...lotCardVm,
      endingSoonPriceRows: {
        estimate: { label: "Estimate", value: "$1k – $2k" },
        current: { label: "Current bid", value: "$900" },
      },
    });
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    await screen.findByRole("dialog");
    const estimateLabel = screen.getByText("Estimate");
    expect(estimateLabel.closest(".rounded-lg")).toBeTruthy();
    expect(screen.getByText("$900")).toBeInTheDocument();
  });

  it("uses a scrollable meta column separate from the media column", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".overflow-y-auto")).toBeTruthy();
    expect(dialog.querySelector(".overflow-hidden.flex-1.flex-col")).toBeTruthy();
  });
});

describe("LotQuickLookDialog reduced motion", () => {
  it("omits transform motion classes when reduced motion is preferred", async () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).not.toMatch(/slide-in-from-bottom/);
    expect(dialog.className).not.toMatch(/zoom-in-95/);
    expect(dialog.className).toMatch(/duration-100/);
  });
});
