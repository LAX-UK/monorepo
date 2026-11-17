import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LotCardGrid } from "@/components/marketing/lot-card";
import { catalogLotCardExtras } from "@/components/marketing/lot-quick-look/catalog-lot-card-extras";
import { saleroomLotCardExtras } from "@/components/marketing/lot-quick-look/saleroom-lot-card-extras";
import { SaleroomLotCard } from "@/components/sections/saleroom/saleroom-lot-card";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import type { CatalogLotVM } from "@auction/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The approved lot card (16-17 Nov): nothing on the artwork at rest but the sale status pill; the
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

/** What styles/lot-card.css says about the quick look label (jsdom applies no stylesheet). */
const LOT_CARD_CSS = (() => {
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../styles/lot-card.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  const media = /@media \(hover: hover\) and \(pointer: fine\) \{([\s\S]*?)\n\}/.exec(css);
  const inMedia = media?.[1] ?? "";
  return {
    hiddenByDefault: /^\.lot-card-quick-look \{\s*display: none;\s*\}/m.test(css),
    shownOnlyFor: /\.lot-card-quick-look \{[^}]*display: inline-flex;[^}]*opacity: 0;/.test(inMedia)
      ? "(hover: hover) and (pointer: fine)"
      : null,
    revealedOnHoverAndFocus:
      inMedia.includes(".group:hover .lot-card-quick-look") &&
      inMedia.includes(".group:focus-within .lot-card-quick-look"),
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

function pictureBox() {
  const imageLink = screen.getByRole("link", { name: "Lot 1: Still Life" });
  const box = imageLink.parentElement;
  if (!box) throw new Error("picture box missing");
  return { imageLink, box };
}

describe("sale page lot card: clean picture", () => {
  it("puts nothing on the picture at rest but the status pill", () => {
    renderSaleCard(true);
    const { imageLink, box } = pictureBox();
    expect(within(imageLink).getByTestId("status-pill")).toBeInTheDocument();
    // The one control in the picture box is the quick look label, invisible at rest (CSS).
    const controls = within(box).queryAllByRole("button");
    expect(controls.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Quick look at Still Life",
    ]);
    expect(controls[0]).toHaveClass("lot-card-quick-look");
    expect(box.querySelector("svg.lucide-heart, svg.lucide-eye")).toBeNull();
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
    // The saved heart is filled; in the Lot line's slot the fill is the Bid accent
    // (styles/lot-card.css recolours `.lot-card-save .fill-live-red`).
    expect(heart.querySelector("svg")?.getAttribute("class")).toContain("fill-live-red");
    expect(heart.closest(".lot-card-save")).not.toBeNull();
    await userEvent.click(heart);
    expect(watch.toggle).toHaveBeenCalledTimes(1);
  });

  it("asks a signed-out visitor to sign in, from the same place", async () => {
    renderSaleCard(false);
    const heart = screen.getByRole("button", {
      name: "Sign in to add Still Life to your watchlist",
    });
    expect(screen.getByTestId("lot-card-lot-line")).toContainElement(heart);
    await userEvent.click(heart);
    expect(push).toHaveBeenCalledWith("/login?next=/lot/still-life/lot-1");
  });
});

describe("sale page lot card: quick look trigger", () => {
  it("is a labelled button on the picture where the pointer can hover", async () => {
    renderSaleCard(true);
    const trigger = screen.getByRole("button", { name: "Quick look at Still Life" });
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveTextContent("Quick look");
    expect(pictureBox().box).toContainElement(trigger);
    expect(pictureBox().imageLink).not.toContainElement(trigger);
    // Hidden at rest, shown on hover or keyboard focus, hover pointers only: styles/lot-card.css.
    expect(trigger).toHaveClass("lot-card-quick-look");
    expect(trigger.closest(".group")).not.toBeNull();
    expect(LOT_CARD_CSS.revealedOnHoverAndFocus).toBe(true);
    await userEvent.click(trigger);
    expect(quickLook.open).toHaveBeenCalledWith(
      expect.objectContaining({ id: "lot-1", title: "Still Life" }),
      expect.objectContaining({ isAuthenticated: true }),
      expect.anything(),
    );
  });

  it("is reached with the keyboard and opens with Enter", async () => {
    renderSaleCard(true);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Quick look at Still Life" });
    await user.tab();
    expect(document.activeElement).toBe(pictureBox().imageLink);
    await user.tab();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard("{Enter}");
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
  images: ["https://example.com/9.jpg"],
  status: "active",
} as unknown as CatalogLotVM;

function renderSearchCard({ watched = false, isAuthenticated = true } = {}) {
  watch.watching = watched;
  return render(
    <LotCardGrid
      href="/lot/harbour/lot-9"
      lotId="lot-9"
      image={<span data-testid="img" />}
      title={<h2>Harbour at Dusk</h2>}
      titleText="Harbour at Dusk"
      lotLabel="Lot 9"
      bottomLeft={<span data-testid="status-pill">Live</span>}
      extras={catalogLotCardExtras(catalogLot, {
        isAuthenticated,
        watchedLotIds: watched ? ["lot-9"] : [],
        loginNextPath: "/search",
      })}
    />,
  );
}

describe("search lot card: the same card", () => {
  it("keeps the picture clean and puts the heart on the Lot N line", () => {
    renderSearchCard();
    const picture = screen.getByTestId("img").closest("a");
    const controls = picture?.parentElement?.querySelectorAll("button") ?? [];
    expect([...controls].map((el) => el.className)).toEqual([
      expect.stringContaining("lot-card-quick-look"),
    ]);
    expect(picture?.parentElement?.querySelector("svg.lucide-heart, svg.lucide-eye")).toBeNull();
    const line = screen.getByTestId("lot-card-lot-line");
    expect(line).toHaveTextContent("Lot 9");
    expect(line).toContainElement(
      screen.getByRole("button", { name: "Add Harbour at Dusk to your watchlist" }),
    );
  });

  it("shows the saved state and the quick look label on a hover-capable pointer", () => {
    renderSearchCard({ watched: true });
    const heart = screen.getByRole("button", {
      name: "Remove Harbour at Dusk from your watchlist",
    });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(heart.closest(".lot-card-save")).not.toBeNull();
    const trigger = screen.getByRole("button", { name: "Quick look at Harbour at Dusk" });
    expect(screen.getByTestId("img").closest("a")).not.toContainElement(trigger);
  });

  it("names the card by its title for keyboard and screen readers", () => {
    renderSearchCard({ isAuthenticated: false });
    expect(screen.getByRole("link", { name: "Harbour at Dusk" })).toHaveAttribute(
      "href",
      "/lot/harbour/lot-9",
    );
    expect(
      screen.getByRole("button", { name: "Sign in to add Harbour at Dusk to your watchlist" }),
    ).toBeInTheDocument();
  });
});
