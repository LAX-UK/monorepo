import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { Lot } from "@auction/types";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeLotQuickLookEnrichment } from "./fetch-lot-quick-look-enrichment.client";
import { LotQuickLookProvider } from "./lot-quick-look-context";
import { LotQuickLookDialog } from "./lot-quick-look-dialog";
import { lotQuickLookEnrichmentFromLot } from "./lot-quick-look-enrichment";
import { LotQuickLookTrigger } from "./lot-quick-look-trigger";
import { lotQuickLookFromLotCardVM, lotQuickLookRailDeck } from "./mappers";
import { quickLookOverlayBlur } from "./quick-look-dialog-utils";
import { type LotQuickLookVM, isLotQuickLookBiddable } from "./types";
import { QUICK_LOOK_HISTORY_KEY, type QuickLookEntry } from "./use-quick-look-history";

/**
 * Stand-ins for the app router: `usePathname` reads `navigation.pathname`, and the mocked
 * `next/link` changes history the way Next does (push, or replace with `replace`), writing a state
 * without the quick look's key.
 */
const navigation = vi.hoisted(() => ({
  pathname: "/",
  replace: vi.fn((href: string) => window.history.replaceState({ __NA: true }, "", href)),
  push: vi.fn((href: string) => window.history.pushState({ __NA: true }, "", href)),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}));

vi.mock("next/link", async () => {
  const { forwardRef } = await import("react");
  type MockLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    replace?: boolean;
    prefetch?: boolean;
  };
  const MockLink = forwardRef<HTMLAnchorElement, MockLinkProps>(function MockLink(
    { href, replace, prefetch: _prefetch, onClick, children, ...rest },
    ref,
  ) {
    return (
      <a
        ref={ref}
        href={href}
        data-replace={replace ? "true" : "false"}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) {
            return;
          }
          event.preventDefault();
          if (replace) navigation.replace(href);
          else navigation.push(href);
        }}
        {...rest}
      >
        {children}
      </a>
    );
  });
  return { __esModule: true, default: MockLink };
});

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
  // Signed out, the real heart pushes the sign-in page with the router.
  MarketingWatchlistHeart: ({
    isAuthenticated,
    loginNextPath,
  }: { isAuthenticated: boolean; loginNextPath: string }) =>
    isAuthenticated ? (
      <button type="button">Watchlist</button>
    ) : (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          navigation.push(`/login?next=${encodeURIComponent(loginNextPath)}`);
        }}
      >
        Sign in to watch
      </button>
    ),
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
  lotLabel: "Lot 12",
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
  signedOut = false,
  showTrigger = true,
  showDialog = true,
}: {
  vm: LotQuickLookVM;
  deck?: LotQuickLookVM[];
  deckIndex?: number;
  deckSourceLabel?: string;
  signedOut?: boolean;
  showTrigger?: boolean;
  showDialog?: boolean;
}) {
  return (
    <LotQuickLookProvider>
      {showTrigger ? (
        <LotQuickLookTrigger
          vm={vm}
          options={{
            isAuthenticated: !signedOut,
            watchedLotIds: [],
            loginNextPath: vm.href,
            ...(deck ? { deck, deckIndex: deckIndex ?? 0 } : {}),
            ...(deckSourceLabel ? { deckSourceLabel } : {}),
          }}
        />
      ) : null}
      {showDialog ? <LotQuickLookDialog /> : null}
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
        artistName: "Artist",
        estimateLine: "$100",
        saleId: "sale-1",
        sellerId: "s1",
      },
      {
        id: "b",
        href: "/lot/b",
        imageUrl: null,
        lotNumber: 2,
        title: "B",
        artistName: "Artist",
        estimateLine: null,
        saleId: "sale-1",
        sellerId: "s2",
      },
    ]);
    expect(deck).toHaveLength(2);
    expect(deck[0]?.title).toBe("A");
    expect(deck[1]?.lotLabel).toBe("Lot 2");
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
    expect(enrichment.buyersPremiumHint).toBe("Buyer's premium: 25% on the hammer");
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

  it("carries no dead animation classes; its motion comes from the shared kit", async () => {
    const vm = lotQuickLookFromLotCardVM(lotCardVm);
    render(<QuickLookHarness vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: /quick look at blue horizon/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).not.toMatch(/animate-in|animate-out|zoom-in|slide-in|fade-in-0/);
  });

  it("navigates deck with arrow keys when lot has a single image", async () => {
    const deck = lotQuickLookRailDeck([
      {
        id: "a",
        href: "/lot/a",
        imageUrl: null,
        lotNumber: 1,
        title: "Lot Alpha",
        artistName: "Artist",
        estimateLine: "$100",
        saleId: "sale-1",
        sellerId: "s1",
      },
      {
        id: "b",
        href: "/lot/b",
        imageUrl: null,
        lotNumber: 2,
        title: "Lot Beta",
        artistName: "Artist",
        estimateLine: null,
        saleId: "sale-1",
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
  it("blurs the scrim behind the panel when motion is allowed", () => {
    expect(quickLookOverlayBlur(false)).toBe("backdrop-blur-sm");
  });

  it("drops the scrim blur when reduced motion is preferred", () => {
    expect(quickLookOverlayBlur(true)).toBe("");
  });
});

describe("LotQuickLookDialog browser history", () => {
  const LIST_PATH = "/sales/spring";

  const twoLotDeck = (): LotQuickLookVM[] => [
    {
      ...lotQuickLookFromLotCardVM(lotCardVm),
      id: "a",
      href: "/lot/alpha",
      title: "Lot Alpha",
      images: [],
      buyersPremiumHint: "Buyer's premium applies",
    },
    {
      ...lotQuickLookFromLotCardVM(lotCardVm),
      id: "b",
      href: "/lot/beta",
      title: "Lot Beta",
      images: [],
    },
  ];

  beforeEach(() => {
    // Each test starts on a fresh list entry with no quick-look key, at the list's address.
    window.history.pushState({ __NA: true }, "", LIST_PATH);
    navigation.pathname = LIST_PATH;
    navigation.replace.mockClear();
    navigation.push.mockClear();
  });

  const spies: { mockRestore: () => void }[] = [];
  function spyOnHistory(method: "back" | "pushState") {
    const spy = vi.spyOn(window.history, method);
    spies.push(spy);
    return spy;
  }

  afterEach(() => {
    for (const spy of spies.splice(0)) spy.mockRestore();
    window.history.replaceState(null, "", "/");
    navigation.pathname = "/";
  });

  function popState() {
    return new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
    });
  }

  async function goBack() {
    const popped = popState();
    window.history.back();
    await popped;
  }

  function entry(): QuickLookEntry | undefined {
    return window.history.state?.[QUICK_LOOK_HISTORY_KEY];
  }

  function renderDeck(props: Partial<Parameters<typeof QuickLookHarness>[0]> = {}) {
    const deck = twoLotDeck();
    const first = deck[0];
    if (!first) throw new Error("Expected a deck");
    return render(<QuickLookHarness vm={first} deck={deck} deckIndex={0} {...props} />);
  }

  async function openDeck(props: Partial<Parameters<typeof QuickLookHarness>[0]> = {}) {
    const view = renderDeck(props);
    fireEvent.click(screen.getByRole("button", { name: /quick look at lot alpha/i }));
    await screen.findByRole("dialog");
    return view;
  }

  it("adds one history entry at the same address when it opens", async () => {
    const lengthBefore = window.history.length;
    const hrefBefore = window.location.href;
    await openDeck();
    expect(window.history.length).toBe(lengthBefore + 1);
    expect(entry()).toEqual({ id: expect.any(String), lotId: "a", href: hrefBefore });
    expect(window.history.state.__NA).toBe(true);
    expect(window.location.href).toBe(hrefBefore);
    const back = popState();
    fireEvent.click(screen.getByRole("button", { name: /back to results/i }));
    await back;
  });

  it("adds no entries while stepping lot to lot", async () => {
    await openDeck();
    const lengthOpen = window.history.length;
    const pushState = spyOnHistory("pushState");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(visibleQuickLookHeading("Lot Beta")).toBeTruthy();
    expect(entry()?.lotId).toBe("b");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(visibleQuickLookHeading("Lot Alpha")).toBeTruthy();
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(lengthOpen);
    const back = popState();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await back;
  });

  it("closes on the browser Back button and stays on the page", async () => {
    const hrefBefore = window.location.href;
    await openDeck();
    await goBack();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.location.href).toBe(hrefBefore);
    expect(entry()).toBeUndefined();
  });

  it("removes its entry when closed with Escape", async () => {
    await openDeck();
    const back = spyOnHistory("back");
    const popped = popState();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(back).toHaveBeenCalledTimes(1);
    await popped;
    expect(entry()).toBeUndefined();
  });

  it("removes its entry when closed with Back to results", async () => {
    await openDeck();
    const popped = popState();
    fireEvent.click(screen.getByRole("button", { name: /back to results/i }));
    await popped;
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entry()).toBeUndefined();
  });

  it.each([
    ["View lot", /^view lot$/i, "/lot/alpha"],
    ["Bid", /^bid$/i, "/lot/alpha#lot-bid-entry"],
    ["Conditions of Sale", /conditions of sale/i, null],
  ])(
    "%s replaces the quick look's entry, so Back from the next page returns to the list",
    async (_name, linkName, expectedHref) => {
      await openDeck();
      const lengthOpen = window.history.length;
      const back = spyOnHistory("back");
      const link = within(screen.getByRole("dialog")).getByRole("link", { name: linkName });
      expect(link).toHaveAttribute("data-replace", "true");
      const target = link.getAttribute("href") ?? "";
      if (expectedHref) expect(target).toBe(expectedHref);

      fireEvent.click(link);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(back).not.toHaveBeenCalled();
      expect(navigation.replace).toHaveBeenCalledWith(target);
      expect(navigation.push).not.toHaveBeenCalled();
      expect(window.history.length).toBe(lengthOpen);
      expect(`${window.location.pathname}${window.location.hash}`).toBe(target);

      // Back from that page lands on the list itself, not on a leftover quick-look step.
      back.mockRestore();
      await goBack();
      expect(window.location.pathname).toBe(LIST_PATH);
      expect(entry()).toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("signed out, the heart's sign-in redirect closes the quick look and takes its entry", async () => {
    await openDeck({ signedOut: true });
    const lengthOpen = window.history.length;
    const back = spyOnHistory("back");
    fireEvent.click(screen.getByRole("button", { name: /sign in to watch/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(navigation.push).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/lot/alpha")}`,
    );
    expect(back).not.toHaveBeenCalled();
    expect(window.history.length).toBe(lengthOpen);
    back.mockRestore();
    await goBack();
    expect(window.location.pathname).toBe(LIST_PATH);
    expect(entry()).toBeUndefined();
  });

  it("closes without stepping back when anything else inside it navigates to another page", async () => {
    const view = await openDeck();
    const back = spyOnHistory("back");
    // A navigation that did not go through the quick look's own links, e.g. a pushed route.
    navigation.push("/elsewhere");
    navigation.pathname = "/elsewhere";
    view.rerender(
      <QuickLookHarness vm={twoLotDeck()[0] as LotQuickLookVM} deck={twoLotDeck()} deckIndex={0} />,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(back).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/elsewhere");
  });

  it("keeps closing on Back after a reload left its entry behind", async () => {
    await openDeck();
    const leftover = entry();
    const lengthBefore = window.history.length;
    cleanup();

    // Reload: fresh modules (so module state restarts), with the leftover entry still current.
    vi.resetModules();
    const { LotQuickLookProvider: Provider } = await import("./lot-quick-look-context");
    const { LotQuickLookDialog: Dialog } = await import("./lot-quick-look-dialog");
    const { LotQuickLookTrigger: Trigger } = await import("./lot-quick-look-trigger");
    const vm = twoLotDeck()[0] as LotQuickLookVM;
    render(
      <Provider>
        <Trigger vm={vm} options={{ isAuthenticated: true, watchedLotIds: [] }} />
        <Dialog />
      </Provider>,
    );
    expect(entry()).toEqual(leftover);

    fireEvent.click(screen.getByRole("button", { name: /quick look at lot alpha/i }));
    await screen.findByRole("dialog");
    // The leftover entry is put back to use rather than stacked on.
    expect(window.history.length).toBe(lengthBefore);
    expect(entry()?.id).not.toBe(leftover?.id);

    await goBack();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // One Back closed it and reached the list: no dead step is left.
    expect(window.location.pathname).toBe(LIST_PATH);
    expect(entry()).toBeUndefined();
  });

  it("reopens the lot on Forward after Back, so the entry is never a dead step", async () => {
    await openDeck();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(visibleQuickLookHeading("Lot Beta")).toBeTruthy();
    await goBack();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const forward = popState();
    window.history.forward();
    await forward;
    await screen.findByRole("dialog");
    expect(visibleQuickLookHeading("Lot Beta")).toBeTruthy();

    // It owns the entry again: closing steps back over it.
    const popped = popState();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await popped;
    expect(entry()).toBeUndefined();
    expect(window.location.pathname).toBe(LIST_PATH);
  });

  it("steps back over its entry on close after a router refresh rewrote it without the key", async () => {
    await openDeck();
    // What Next's refresh and server-action updates do to the current entry.
    window.history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: [] }, "");
    const back = spyOnHistory("back");
    const popped = popState();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await popped;
    expect(back).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe(LIST_PATH);
  });

  it("does not open over another page when its list went away before it loaded", async () => {
    const view = renderDeck({ showDialog: false });
    fireEvent.click(screen.getByRole("button", { name: /quick look at lot alpha/i }));
    const pushState = spyOnHistory("pushState");
    // Back was pressed while the dialog was loading: the list, and its trigger, are gone.
    view.rerender(
      <QuickLookHarness
        vm={twoLotDeck()[0] as LotQuickLookVM}
        deck={twoLotDeck()}
        deckIndex={0}
        showTrigger={false}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pushState).not.toHaveBeenCalled();
  });
});
