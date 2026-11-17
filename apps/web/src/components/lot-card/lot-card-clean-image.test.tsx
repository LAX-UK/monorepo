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
    setPointer({ hover: false });
    renderSaleCard(true);
    const { imageLink, box } = pictureBox();
    expect(within(imageLink).getByTestId("status-pill")).toBeInTheDocument();
    expect(within(box).queryAllByRole("button")).toHaveLength(0);
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

  it("is an outline heart with a 44px tap target when not saved", () => {
    renderSaleCard(true);
    const heart = screen.getByRole("button", { name: "Add Still Life to your watchlist" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(heart.className).toContain("size-[var(--tap-target-min,44px)]");
    expect(heart.querySelector("svg")?.getAttribute("class")).toContain("fill-transparent");
  });

  it("is filled in the Bid accent when saved, and toggles the watchlist", async () => {
    watch.watching = true;
    renderSaleCard(true, { ...saleLot, viewerIsWatching: true });
    const heart = screen.getByRole("button", { name: "Remove Still Life from your watchlist" });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    const icon = heart.querySelector("svg")?.getAttribute("class") ?? "";
    expect(icon).toContain("fill-product-accent");
    expect(icon).not.toContain("fill-live-red");
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
    // Hidden at rest, shown while the card is hovered or holds keyboard focus.
    expect(trigger.className).toContain("opacity-0");
    expect(trigger.className).toContain("group-hover:opacity-100");
    expect(trigger.className).toContain("group-focus-within:opacity-100");
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

  it("is not drawn on a phone (no hover): a tap opens the lot page", () => {
    setPointer({ hover: false });
    renderSaleCard(true);
    expect(screen.queryByRole("button", { name: /quick look/i })).not.toBeInTheDocument();
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
    setPointer({ hover: false });
    renderSearchCard();
    const picture = screen.getByTestId("img").closest("a");
    expect(picture?.parentElement?.querySelectorAll("button")).toHaveLength(0);
    const line = screen.getByTestId("lot-card-lot-line");
    expect(line).toHaveTextContent("Lot 9");
    expect(line).toContainElement(
      screen.getByRole("button", { name: "Add Harbour at Dusk to your watchlist" }),
    );
    expect(screen.queryByRole("button", { name: /quick look/i })).not.toBeInTheDocument();
  });

  it("shows the saved state and the quick look label on a hover-capable pointer", () => {
    renderSearchCard({ watched: true });
    const heart = screen.getByRole("button", {
      name: "Remove Harbour at Dusk from your watchlist",
    });
    expect(heart.querySelector("svg")?.getAttribute("class")).toContain("fill-product-accent");
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
