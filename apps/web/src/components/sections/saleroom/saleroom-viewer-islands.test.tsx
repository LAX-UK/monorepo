import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import {
  SaleMobileSummaryBarIsland,
  SaleroomHeroActionRowIsland,
} from "@/components/sections/saleroom/saleroom-viewer-islands";
import type { SaleHeroVM } from "@/components/sections/saleroom/view-models";
import { SIGNED_OUT_SALE_VIEWER, type SaleViewerVM } from "@/lib/marketing/sale-viewer";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let viewer: SaleViewerVM;
let loaded: boolean;

vi.mock("@/components/sections/saleroom/sale-viewer-provider", () => ({
  useSaleViewer: () => viewer,
  useSaleViewerLoaded: () => loaded,
}));
vi.mock("@/components/sections/saleroom/saleroom-follow-toggle", () => ({
  SaleroomFollowToggle: () => <button type="button">Notify me</button>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/hooks/use-sale-phone-bar-visible", () => ({ useSalePhoneBarVisible: () => true }));
vi.mock("@/lib/context/saleroom-live-provider", () => ({ useSaleroomLive: () => null }));
vi.mock("@/lib/sale/use-active-sale-countdown-end-iso", () => ({
  useActiveSaleCountdownEndIso: () => null,
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
);

const SALE_HREF = "/sales/spring-sale/sale-1";
type Status = SaleHeroVM["status"];

const hero = (status: Status): SaleHeroVM => ({
  id: "sale-1",
  title: "Spring sale",
  subtitle: null,
  coverImage: null,
  dateLine: "18 Nov 2026",
  itemsLabel: "12 lots",
  lotCount: 12,
  formatLabel: "Online",
  placeLabel: null,
  status,
  isLive: status === "active",
  startTime: "2026-11-18T10:00:00.000Z",
  endTime: "2026-11-20T18:00:00.000Z",
  startEndLabel: "18 – 20 Nov",
  shareUrl: "https://example.com/sales/spring-sale/sale-1",
  timeZone: "Europe/London",
  previewOpensIso: null,
  registrationClosesShort: null,
  biddingStartsShort: null,
  leftColumnLabel: null,
  rightColumnLabel: null,
  deliveryMode: "online",
});

type Scenario = { status?: Status; registerToBidSale?: boolean };

/** The hero's actions and the phone bar, side by side, for one viewer. */
function renderBoth({ status = "scheduled", registerToBidSale = true }: Scenario = {}) {
  render(
    <>
      <div data-testid="hero">
        <SaleroomHeroActionRowIsland
          hero={hero(status)}
          deliveryMode="online"
          saleId="sale-1"
          saleHref={SALE_HREF}
          registerToBidSale={registerToBidSale}
          saleCurrency="GBP"
        />
      </div>
      {/* The bar portals into the cookie dock, as on the page. */}
      <div data-testid="bar">
        <CookieDock />
      </div>
      <SaleMobileSummaryBarIsland
        start={new Date("2026-11-18T10:00:00Z")}
        end={new Date("2026-11-20T18:00:00Z")}
        status={status}
        deliveryMode="online"
        saleTitle="Spring sale"
        atgReadOnly={false}
        registerToBidSale={registerToBidSale}
        saleHref={SALE_HREF}
      />
    </>,
  );
  const heroLinks = within(screen.getByTestId("hero")).queryAllByRole("link");
  const barLinks = within(screen.getByTestId("bar")).getAllByRole("link");
  expect(heroLinks.length).toBeLessThanOrEqual(1);
  expect(barLinks).toHaveLength(1);
  const read = (link: HTMLElement | undefined) =>
    link ? { label: link.textContent, href: link.getAttribute("href") } : null;
  return { hero: read(heroLinks[0]), bar: read(barLinks[0]) };
}

const signedIn = (over: Partial<SaleViewerVM>): SaleViewerVM => ({
  ...SIGNED_OUT_SALE_VIEWER,
  isAuthenticated: true,
  canParticipateAsBuyer: true,
  kycApproved: true,
  orgModuleEnabled: true,
  ...over,
});
const agent = { id: "le-1", displayName: "Harbour Buying Ltd", memberRole: "buyer_agent" as const };
const owner = { id: "le-2", displayName: "Estuary Holdings", memberRole: "owner" as const };
const registration = (status: SaleViewerVM["myRegistrations"][number]["status"]) => ({
  buyerLegalEntityId: agent.id,
  status,
  bidLimit: null,
  paddleNumber: null,
  checkedInAt: null,
});
const registeredAgent = signedIn({
  buyerEntities: [agent],
  myRegistrations: [registration("approved")],
  hasApprovedRegistration: true,
});
const signUp = `/api/auth/login?next=${encodeURIComponent(SALE_HREF)}&intent=signup`;
const VIEW_LOTS = { label: "View lots", href: "#catalog" };

/*
 * The review's state table: whatever the hero offers is what the bar offers, and where the hero
 * offers nothing the bar offers the lots (or the results). No state sends anyone to the
 * create-account page.
 */
type Row = [string, SaleViewerVM, Scenario, { label: string; href: string } | null];
const STATES: readonly Row[] = [
  ["signed out", SIGNED_OUT_SALE_VIEWER, {}, { label: "Register to bid", href: signUp }],
  [
    "signed in, identity check not started",
    signedIn({ kycApproved: false }),
    {},
    {
      label: "Verify identity to bid",
      href: "/onboarding/identity?next=%2Fsales%2Fspring-sale%2Fsale-1&source=registration",
    },
  ],
  [
    "signed in, identity check in review",
    signedIn({
      kycApproved: false,
      kycFeedback: {
        headline: "In review",
        detail: null,
        action: "wait",
        reasonCode: null,
        decisionStatus: null,
        needsResubmit: false,
      },
    }),
    {},
    {
      label: "Verification in review",
      href: "/onboarding/identity?next=%2Fsales%2Fspring-sale%2Fsale-1&source=registration",
    },
  ],
  [
    "no buyer profile yet",
    signedIn({}),
    {},
    { label: "Set up a buyer profile", href: "/onboarding/organisation" },
  ],
  ["private collector, not registered", signedIn({ buyerEntities: [owner] }), {}, null],
  [
    "buyer agent, no registration",
    signedIn({ buyerEntities: [agent] }),
    {},
    { label: "Register to bid", href: "#register-to-bid" },
  ],
  ...(["pending", "rejected", "withdrawn"] as const).map(
    (status): Row => [
      `buyer agent, registration ${status}`,
      signedIn({ buyerEntities: [agent], myRegistrations: [registration(status)] }),
      {},
      { label: "Register to bid", href: "#register-to-bid" },
    ],
  ),
  ["registration approved", registeredAgent, {}, null],
  [
    "registration approved, identity check lapsed",
    { ...registeredAgent, kycApproved: false },
    {},
    null,
  ],
  ["sale takes no web registrations", SIGNED_OUT_SALE_VIEWER, { registerToBidSale: false }, null],
  [
    "live sale, signed out",
    SIGNED_OUT_SALE_VIEWER,
    { status: "active" },
    { label: "Register to bid", href: signUp },
  ],
  [
    "live sale, buyer agent not registered",
    signedIn({ buyerEntities: [agent] }),
    { status: "active" },
    { label: "Register to bid", href: "#register-to-bid" },
  ],
  ["live sale, registered", registeredAgent, { status: "active" }, null],
  ["staff viewer", signedIn({ canParticipateAsBuyer: false }), {}, null],
];

describe("the phone bar offers exactly the hero's primary action", () => {
  beforeEach(() => {
    loaded = true;
  });

  it.each(STATES)("%s", (_name, state, scenario, expected) => {
    viewer = state;
    const { hero, bar } = renderBoth(scenario);
    expect(hero).toEqual(expected);
    expect(bar).toEqual(hero ?? VIEW_LOTS);
    expect(bar?.href).not.toBe("/register");
  });

  it.each(["ended", "cancelled", "voided"] as const)(
    "a %s sale offers no register anywhere, and its results in the bar",
    (status) => {
      viewer = SIGNED_OUT_SALE_VIEWER;
      const { hero, bar } = renderBoth({ status });
      expect(hero).toBeNull();
      expect(bar).toEqual({ label: "View results", href: "#catalog" });
    },
  );

  it("says You're registered in the hero from the viewer's one registered flag", () => {
    viewer = { ...registeredAgent, myRegistrations: [] };
    renderBoth();
    expect(screen.getByText("You're registered")).toBeInTheDocument();
  });

  it("offers the lots in the bar and holds the hero's button, not a guess, until the viewer has loaded", () => {
    loaded = false;
    viewer = SIGNED_OUT_SALE_VIEWER;
    render(
      <>
        <div data-testid="hero">
          <SaleroomHeroActionRowIsland
            hero={hero("scheduled")}
            deliveryMode="online"
            saleId="sale-1"
            saleHref={SALE_HREF}
            registerToBidSale
            saleCurrency="GBP"
          />
        </div>
        <CookieDock />
        <SaleMobileSummaryBarIsland
          start={new Date("2026-11-18T10:00:00Z")}
          end={new Date("2026-11-20T18:00:00Z")}
          status="scheduled"
          saleTitle="Spring sale"
          atgReadOnly={false}
          registerToBidSale
          saleHref={SALE_HREF}
        />
      </>,
    );
    expect(screen.getByRole("link", { name: "View lots" })).toHaveAttribute("href", "#catalog");
    expect(screen.queryByRole("link", { name: "Register to bid" })).toBeNull();
    // The hero holds its place but offers nothing to click until the viewer is known.
    const heroBox = within(screen.getByTestId("hero"));
    expect(heroBox.queryAllByRole("link")).toHaveLength(0);
    expect(heroBox.queryByText("Register to bid")?.closest("button")).toBeDisabled();
  });
});
