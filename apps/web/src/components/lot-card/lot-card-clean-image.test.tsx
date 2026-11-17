import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CatalogLotCardView, CatalogLotGridView } from "@/components/marketing/catalog-lot-views";
import { saleroomLotCardExtras } from "@/components/marketing/lot-quick-look/saleroom-lot-card-extras";
import { ArtistWorksGrid } from "@/components/sections/artists/artist-works-grid";
import { HomeLotGrid } from "@/components/sections/home/sections/home-lot-grid";
import { SaleroomLotCard } from "@/components/sections/saleroom/saleroom-lot-card";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import type { HomeLotCard } from "@/lib/home-sections/types";
import type { CatalogLotVM, Lot } from "@auction/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The one lot card (components/lot-card/lot-card.tsx), as the sale page, search (grid and card
 * views), the home rails and the artist page draw it. The approved card (16-17 Nov): nothing on the artwork at rest but the sale status pill; the
 * save heart at the end of the "Lot N" line; quick look as a label on the picture shown on hover
 * or keyboard focus, and only where the pointer can hover.
 */

const watch = vi.hoisted(() => ({ watching: false, toggle: vi.fn() }));
vi.mock("@/lib/watchlist/use-watchlist-toggle", () => ({
  useWatchlistToggle: ({ loginNextPath }: { loginNextPath: string }) => ({
    watching: watch.watching,
    busy: false,
    error: null,
    announce: null,
    toggle: watch.toggle,
    loginHref: `/login?next=${loginNextPath}`,
  }),
}));

const quickLook = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/components/marketing/lot-quick-look/lot-quick-look-context", () => ({
  useLotQuickLookOptional: () => ({ openQuickLook: quickLook.open }),
}));
vi.mock("@/components/marketing/lot-quick-look/lot-quick-look-dialog.lazy", () => ({
  preloadLotQuickLookDialog: () => Promise.resolve(),
}));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));
vi.mock("@/components/lot-card/lot-card-bidder-state", () => ({
  LotCardBidderState: () => null,
}));
vi.mock("@/components/sections/saleroom/saleroom-lot-catalog-overlay", () => ({
  SaleroomLotCatalogOverlay: () => <span data-testid="status-pill">Sold</span>,
}));

/** What styles/lot-card.css says about the card (jsdom applies no stylesheet). */
const LOT_CARD_CSS = (() => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../styles/lot-card.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  const media = /@media \(hover: hover\) and \(pointer: fine\) \{([\s\S]*?)\n\}/.exec(css);
  const inMedia = media?.[1] ?? "";
  const rule = (source: string, selector: string) => {
    const at = source.indexOf(`${selector} {`);
    if (at < 0) return "";
    return source.slice(at, source.indexOf("}", at));
  };
  const label = rule(inMedia, ".lot-card-quick-look");
  const saved = rule(css, ".lot-card-save .fill-live-red");
  const raise = /margin-bottom: ([\d.]+)rem;/.exec(label);
  return {
    hiddenByDefault: /^\.lot-card-quick-look \{\s*display: none;\s*\}/m.test(css),
    shownOnlyFor: /display: inline-flex;[^}]*opacity: 0;/.test(label)
      ? "(hover: hover) and (pointer: fine)"
      : null,
    revealedOnHoverAndFocus:
      inMedia.includes(".group:hover .lot-card-quick-look") &&
      inMedia.includes(".group:focus-within .lot-card-quick-look"),
    /** The label shares the picture's grid cell, so it is drawn over the picture. */
    labelOverPicture:
      /grid-area: 1 \/ 1;/.test(label) && /grid-area: 1 \/ 1;/.test(rule(css, ".lot-card-picture")),
    /** How far above the picture's bottom edge the label sits, in rem. */
    labelRaiseRem: raise ? Number(raise[1]) : 0,
    /** The saved heart's fill and outline in the Lot line: the Bid accent, not live red. */
    savedFill: /fill: var\(([^)]+)\);/.exec(saved)?.[1] ?? null,
    savedStroke: /stroke: var\(([^)]+)\);/.exec(saved)?.[1] ?? null,
  };
})();

function setPointer({ hover }: { hover: boolean }) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("hover: hover") ? hover : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  watch.watching = false;
  watch.toggle.mockReset();
  quickLook.open.mockReset();
  push.mockReset();
  setPointer({ hover: true });
});

const saleLot: SaleLotCardVM = {
  id: "lot-1",
  href: "/lot/still-life/lot-1",
  lotLabel: "Lot 1",
  title: "Still Life",
  imageUrl: "https://example.com/lot.jpg",
  imageAlt: "Still Life",
  displayStyle: "wall",
  estimateValue: "£1,000",
  currentBidLabel: "Current bid",
  currentBidValue: "£500",
  cardLine: { label: "Current bid", value: "£500", time: "none", startsAt: null, endsAt: null },
  bidsCountLabel: null,
  closingLabel: null,
  closingShort: null,
  isLive: true,
  viewerOwnsLot: false,
  artistOrMedium: "Oil on canvas",
  viewerIsWatching: false,
  status: "active",
  startTime: null,
  endTime: null,
};

const sale = { status: "active", deliveryMode: "online" } as const;

function renderSaleCard(isAuthenticated: boolean, lot: SaleLotCardVM = saleLot) {
  return render(
    <SaleroomLotCard
      lot={lot}
      saleForLifecycle={sale}
      extras={saleroomLotCardExtras(lot, isAuthenticated)}
    />,
  );
}

function pictureBox(scope: HTMLElement = document.body) {
  const box = within(scope).getByTestId("lot-card-media");
  const imageLink = box.querySelector("a");
  if (!imageLink) throw new Error("picture link missing");
  return { imageLink, box };
}

/** Every control drawn inside a card's picture box (the picture link itself is not a tab stop). */
function controlsInPicture(box: HTMLElement) {
  return within(box).queryAllByRole("button", { hidden: true });
}

/** Elements a Tab press reaches, in order. */
function tabStops() {
  return [...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")].filter(
    (el) => el.tabIndex >= 0,
  );
}

describe("sale page lot card: clean picture", () => {
  it("puts nothing on the picture at rest but the status pill", () => {
    renderSaleCard(true);
    const { imageLink, box } = pictureBox();
    expect(within(box).getByTestId("status-pill")).toBeInTheDocument();
    expect(controlsInPicture(box)).toEqual([]);
    expect(box.querySelector("svg.lucide-heart, svg.lucide-eye")).toBeNull();
    // The picture opens the lot page but is not a second tab stop: the title is the card's link.
    expect(imageLink).toHaveAttribute("href", "/lot/still-life/lot-1");
    expect(imageLink).toHaveAttribute("tabindex", "-1");
  });

  it("puts the save heart at the right end of the Lot N line", () => {
    renderSaleCard(true);
    const line = screen.getByTestId("lot-card-lot-line");
    const heart = screen.getByRole("button", { name: "Add Still Life to your watchlist" });
    expect(line).toHaveTextContent("Lot 1");
    expect(line).toContainElement(heart);
    expect(line.lastElementChild).toContainElement(heart);
    expect(pictureBox().box).not.toContainElement(heart);
  });

  it("is a quiet outline heart with a 44px tap target when not saved", () => {
    renderSaleCard(true);
    const heart = screen.getByRole("button", { name: "Add Still Life to your watchlist" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(heart.className).toContain("min-h-[var(--tap-target-min,44px)]");
    expect(heart.className).toContain("min-w-[var(--tap-target-min,44px)]");
    expect(heart.querySelector("svg")?.getAttribute("class")).toContain("fill-transparent");
    // The line's slot strips the toolbar heart's round chrome (styles/lot-card.css).
    const slot = heart.closest(".lot-card-save");
    expect(screen.getByTestId("lot-card-lot-line")).toContainElement(slot as HTMLElement);
  });

  it("is filled in the Bid accent when saved, and toggles the watchlist", async () => {
    watch.watching = true;
    renderSaleCard(true, { ...saleLot, viewerIsWatching: true });
    const heart = screen.getByRole("button", { name: "Remove Still Life from your watchlist" });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    // The saved heart's filled shape sits in the Lot line's slot, where the stylesheet paints it
    // (fill and outline) in the Bid accent rather than the toolbar's live red.
    expect(heart.querySelector("svg")?.getAttribute("class")).toContain("fill-live-red");
    expect(heart.closest(".lot-card-save")).not.toBeNull();
    expect(LOT_CARD_CSS.savedFill).toBe("--color-product-accent");
    expect(LOT_CARD_CSS.savedStroke).toBe("--color-product-accent");
    fireEvent.click(heart);
    expect(watch.toggle).toHaveBeenCalledTimes(1);
  });

  it("asks a signed-out visitor to sign in, from the same place", async () => {
    renderSaleCard(false);
    const heart = screen.getByRole("button", {
      name: "Sign in to add Still Life to your watchlist",
    });
    expect(screen.getByTestId("lot-card-lot-line")).toContainElement(heart);
    fireEvent.click(heart);
    expect(push).toHaveBeenCalledWith("/login?next=/lot/still-life/lot-1");
  });
});

describe("sale page lot card: quick look trigger", () => {
  it("is a labelled button drawn over the picture, outside the picture link", async () => {
    renderSaleCard(true);
    const trigger = screen.getByRole("button", { name: "Quick look at Still Life" });
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveTextContent("Quick look");
    expect(pictureBox().imageLink).not.toContainElement(trigger);
    // It is a cell-mate of the picture in the card's grid: drawn over it, read after the title.
    expect(trigger.parentElement).toBe(screen.getByTestId("lot-card"));
    expect(LOT_CARD_CSS.labelOverPicture).toBe(true);
    // Hidden at rest, shown on hover or keyboard focus, hover pointers only: styles/lot-card.css.
    expect(trigger).toHaveClass("lot-card-quick-look");
    expect(trigger.closest(".group")).not.toBeNull();
    expect(LOT_CARD_CSS.revealedOnHoverAndFocus).toBe(true);
    fireEvent.click(trigger);
    expect(quickLook.open).toHaveBeenCalledWith(
      expect.objectContaining({ id: "lot-1", title: "Still Life" }),
      expect.objectContaining({ isAuthenticated: true }),
      expect.anything(),
    );
  });

  it("sits clear of the status pill's row, never on its baseline", () => {
    // The pill sits 0.75rem from the bottom and is about 1.625rem tall (2.375rem in all).
    expect(LOT_CARD_CSS.labelRaiseRem).toBeGreaterThanOrEqual(2.75);
  });

  it("comes right after the title in tab order, and takes keyboard focus", () => {
    renderSaleCard(true);
    const trigger = screen.getByRole("button", { name: "Quick look at Still Life" });
    const title = screen.getByRole("link", { name: "Still Life" });
    const stops = tabStops();
    // A screen reader hears the lot's name before "Quick look at …".
    expect(stops.indexOf(title)).toBeGreaterThanOrEqual(0);
    expect(stops[stops.indexOf(title) + 1]).toBe(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    // A native button: Enter and Space press it.
    expect(trigger.tagName).toBe("BUTTON");
    fireEvent.click(trigger);
    expect(quickLook.open).toHaveBeenCalledTimes(1);
  });

  it("is shown only where the pointer can hover; on a phone the picture is the lot page link", () => {
    renderSaleCard(true);
    const trigger = screen.getByRole("button", { name: "Quick look at Still Life" });
    expect(LOT_CARD_CSS.hiddenByDefault).toBe(true);
    expect(LOT_CARD_CSS.shownOnlyFor).toBe("(hover: hover) and (pointer: fine)");
    expect(trigger).toHaveClass("lot-card-quick-look");
    expect(pictureBox().imageLink).toHaveAttribute("href", "/lot/still-life/lot-1");
  });
});

const catalogLot = {
  id: "lot-9",
  title: "Harbour at Dusk",
  lotNumber: 9,
  slug: "harbour",
  images: ["https://example.com/9.jpg"],
  status: "active",
  startTime: null,
  endTime: null,
  sellerId: "seller-1",
  medium: "Oil on board",
  currency: "GBP",
  startingPrice: "1000.00",
  currentPrice: "1200.00",
} as unknown as CatalogLotVM;

function renderSearch(
  View: typeof CatalogLotGridView,
  { watched = false, isAuthenticated = true } = {},
) {
  watch.watching = watched;
  return render(
    <View
      lots={[catalogLot]}
      currentUserId={null}
      isAuthenticated={isAuthenticated}
      watchedLotIds={watched ? ["lot-9"] : []}
      loginNextPath="/search"
    />,
  );
}

describe.each([
  ["grid view", CatalogLotGridView],
  ["card view (?view=card)", CatalogLotCardView],
])("search %s: the same lot card", (_name, View) => {
  it("keeps the picture clean and puts the heart on the Lot N line", () => {
    renderSearch(View);
    const { box } = pictureBox();
    expect(controlsInPicture(box)).toEqual([]);
    expect(box.querySelector("svg.lucide-heart, svg.lucide-eye")).toBeNull();
    const line = screen.getByTestId("lot-card-lot-line");
    expect(line).toHaveTextContent("Lot 9");
    expect(line).toContainElement(
      screen.getByRole("button", { name: "Add Harbour at Dusk to your watchlist" }),
    );
  });

  it("shows the saved state, and the quick look label outside the picture link", () => {
    renderSearch(View, { watched: true });
    const heart = screen.getByRole("button", {
      name: "Remove Harbour at Dusk from your watchlist",
    });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(heart.closest(".lot-card-save")).not.toBeNull();
    const trigger = screen.getByRole("button", { name: "Quick look at Harbour at Dusk" });
    expect(pictureBox().imageLink).not.toContainElement(trigger);
    expect(trigger.parentElement).toBe(screen.getByTestId("lot-card"));
  });

  it("names the card by its title, read before quick look", () => {
    renderSearch(View, { isAuthenticated: false });
    const title = screen.getByRole("link", { name: "Harbour at Dusk" });
    expect(title.getAttribute("href")).toContain("lot-9");
    const stops = tabStops();
    expect(stops[stops.indexOf(title) + 1]).toBe(
      screen.getByRole("button", { name: "Quick look at Harbour at Dusk" }),
    );
    expect(
      screen.getByRole("button", { name: "Sign in to add Harbour at Dusk to your watchlist" }),
    ).toBeInTheDocument();
  });

  it("has the full-width button, Bid on an open lot", () => {
    renderSearch(View);
    const action = screen.getByTestId("lot-card-action");
    expect(within(action).getByRole("link", { name: "Bid" }).getAttribute("href")).toContain(
      "lot-9",
    );
  });
});

const homeLot: HomeLotCard = {
  id: "lot-4",
  href: "/lot/evening/lot-4",
  title: "Evening Light",
  artistName: "A. Painter",
  imageUrl: "https://example.com/4.jpg",
  displayStyle: "object",
  watchable: true,
  status: "scheduled",
  lotLabel: "Lot 4",
  estimate: "£4,000 – £6,000",
  line: { label: "Starting bid", value: "£3,000", time: "none", startsAt: null, endsAt: null },
};

describe("home rails: the same lot card", () => {
  it("puts nothing on the picture, the heart on the Lot N line, and offers quick look", () => {
    render(
      <HomeLotGrid
        lots={[homeLot]}
        label="Coming up"
        watch={{ isAuthenticated: true, watchedLotIds: ["lot-4"] }}
      />,
    );
    const { box } = pictureBox();
    expect(controlsInPicture(box)).toEqual([]);
    const line = screen.getByTestId("lot-card-lot-line");
    expect(line).toHaveTextContent("Lot 4");
    expect(line).toContainElement(
      screen.getByRole("button", { name: "Add Evening Light to your watchlist" }),
    );
    expect(screen.getByRole("button", { name: "Quick look at Evening Light" }).parentElement).toBe(
      screen.getByTestId("lot-card"),
    );
    // A lot that is not open yet: no "Bid" on the card (the rail cannot know the register step).
    expect(screen.queryByTestId("lot-card-action")).toBeNull();
  });
});

describe("artist page: the same lot card", () => {
  it("puts the heart on the Lot N line and nothing on the picture", () => {
    render(
      <ArtistWorksGrid
        lots={[
          {
            ...(catalogLot as unknown as Lot),
            startTime: new Date("2026-11-20T10:00:00Z"),
            endTime: new Date("2026-11-27T10:00:00Z"),
            createdAt: new Date("2020-01-01T00:00:00Z"),
          },
        ]}
        currentUserId={null}
        label="On sale"
        watch={{ isAuthenticated: true, watchedLotIds: [], loginNextPath: "/artist/a/1" }}
      />,
    );
    const { box } = pictureBox();
    expect(controlsInPicture(box)).toEqual([]);
    expect(screen.getByTestId("lot-card-lot-line")).toContainElement(
      screen.getByRole("button", { name: "Add Harbour at Dusk to your watchlist" }),
    );
    expect(
      within(screen.getByTestId("lot-card-action")).getByRole("link", { name: "Bid" }),
    ).toBeInTheDocument();
  });
});
