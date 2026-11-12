import { BidBottomTabBar } from "@/components/layout/bid-bottom-tab-bar";
import { WorkspaceTabBar } from "@/components/workspace/workspace-tab-bar";
import type { BidAttention } from "@/hooks/use-bid-attention";
import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { getClientMobileTabs, getClientNavSections } from "@/lib/navigation/client-nav-model";
import { claimBottomSlot } from "@auction/marketing-ui/bottom-bar/bottom-slot";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
let session: BidAttention;
const openPalette = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/hooks/use-bid-attention", () => ({ useBidAttention: () => session }));
vi.mock("@/components/layout/command-palette-events", () => ({
  openCommandPalette: () => openPalette(),
}));

const SIGNED_OUT: BidAttention = {
  signedIn: false,
  viewer: null,
  pending: false,
  attention: null,
  chip: null,
};
const signedIn = (attention = NO_ATTENTION): BidAttention => ({
  signedIn: true,
  viewer: { displayName: "Jordan Hale", email: "jordan@example.com" },
  pending: false,
  attention,
  chip: null,
});

beforeEach(() => {
  pathname = "/";
  session = SIGNED_OUT;
  openPalette.mockReset();
});

afterEach(() => {
  document.documentElement.removeAttribute("data-lax-bottom-bar");
});

function tab(name: string) {
  return screen.getByRole("link", { name: new RegExp(`^${name}`) });
}

describe("BidBottomTabBar tabs", () => {
  it("shows Home, Auctions, Search, Watching and Account in that order", () => {
    render(<BidBottomTabBar />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["Home", "Auctions", "Search", "Watching", "Account"]);
  });

  it("shows the person's initials on the Account tab when signed in, and a person icon when not", () => {
    session = signedIn();
    const { unmount } = render(<BidBottomTabBar />);
    expect(tab("Account")).toHaveTextContent("JH");
    unmount();
    session = SIGNED_OUT;
    render(<BidBottomTabBar />);
    expect(tab("Account")).not.toHaveTextContent("JH");
  });

  it.each([
    ["/", "Home"],
    ["/sales", "Auctions"],
    ["/sales/spring-sale", "Auctions"],
    ["/lot/estuary-at-dawn/abc-123", "Auctions"],
  ])("marks %s as the %s tab and no other", (path, label) => {
    pathname = path;
    render(<BidBottomTabBar />);
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });

  it("does not mark Home on other pages", () => {
    pathname = "/artists";
    render(<BidBottomTabBar />);
    expect(
      screen.getAllByRole("link").some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(false);
  });

  it("opens the existing search sheet from Search, which is a button", () => {
    render(<BidBottomTabBar />);
    fireEvent.click(screen.getByRole("button", { name: /^Search/ }));
    expect(openPalette).toHaveBeenCalledTimes(1);
  });
});

describe("BidBottomTabBar badges", () => {
  it("shows no dots when nothing is waiting", () => {
    session = signedIn();
    render(<BidBottomTabBar />);
    expect(screen.queryByTestId("tab-badge-Watching")).toBeNull();
    expect(screen.queryByTestId("tab-badge-Account")).toBeNull();
  });

  it("puts a dot on Watching while the person is outbid", () => {
    session = signedIn({ ...NO_ATTENTION, outbidLots: ["14"] });
    render(<BidBottomTabBar />);
    expect(screen.getByTestId("tab-badge-Watching")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-badge-Account")).toBeNull();
    expect(tab("Watching")).toHaveAttribute("aria-label", "Watching, needs attention");
  });

  it.each([
    ["a payment due", { paymentsDue: 1 }],
    ["an account in review", { paymentsDue: 1, paymentsInReview: true }],
    ["unread notifications", { unreadNotifications: 3 }],
  ])("puts a dot on Account for %s", (_name, patch) => {
    session = signedIn({ ...NO_ATTENTION, ...patch });
    render(<BidBottomTabBar />);
    expect(screen.getByTestId("tab-badge-Account")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-badge-Watching")).toBeNull();
  });

  it("shows no dots to a signed-out visitor", () => {
    render(<BidBottomTabBar />);
    expect(screen.queryByTestId("tab-badge-Watching")).toBeNull();
    expect(screen.queryByTestId("tab-badge-Account")).toBeNull();
  });
});

describe("BidBottomTabBar signed out", () => {
  it("sends Watching and Account to Sign in and back to that page", () => {
    render(<BidBottomTabBar />);
    expect(tab("Watching")).toHaveAttribute("href", "/api/auth/login?next=%2Fwatching");
    expect(tab("Account")).toHaveAttribute("href", "/api/auth/login?next=%2Fhome");
  });

  it("links straight to the pages once signed in", () => {
    session = signedIn();
    render(<BidBottomTabBar />);
    expect(tab("Watching")).toHaveAttribute("href", "/watching");
    expect(tab("Account")).toHaveAttribute("href", "/home");
  });

  it("links straight to the pages while the session is still loading", () => {
    session = { signedIn: false, viewer: null, pending: true, attention: null, chip: null };
    render(<BidBottomTabBar />);
    expect(tab("Watching")).toHaveAttribute("href", "/watching");
  });
});

describe("BidBottomTabBar one bar at a time", () => {
  it.each(["/home", "/bids", "/purchases", "/watching", "/notifications", "/settings"])(
    "renders nothing in the account area (%s), where the account's own bar shows",
    (path) => {
      pathname = path;
      session = signedIn();
      render(<BidBottomTabBar />);
      expect(screen.queryByTestId("bid-bottom-tab-bar")).toBeNull();
      expect(document.documentElement).not.toHaveAttribute("data-lax-bottom-bar");
    },
  );

  it.each(["/purchases/checkout", "/purchases/checkout/lot-1", "/pay", "/checkout/x"])(
    "renders nothing on pay and checkout routes (%s)",
    (path) => {
      pathname = path;
      render(<BidBottomTabBar />);
      expect(screen.queryByTestId("bid-bottom-tab-bar")).toBeNull();
    },
  );

  it("steps aside while another bar holds the shared bottom slot, and returns after", () => {
    pathname = "/lot/estuary/abc";
    render(<BidBottomTabBar />);
    const nav = screen.getByTestId("bid-bottom-tab-bar");
    expect(nav).toHaveAttribute("data-visible", "true");
    let release = () => {};
    act(() => {
      release = claimBottomSlot("lot-phone-bar");
    });
    expect(nav).toHaveAttribute("data-visible", "false");
    expect(nav).toHaveAttribute("data-hidden-reason", "slot-claimed");
    expect(document.documentElement).not.toHaveAttribute("data-lax-bottom-bar");
    act(() => release());
    expect(nav).toHaveAttribute("data-visible", "true");
  });

  it("leaves the account area to its own bar: exactly one bottom bar shows at a time", () => {
    const scope = { context: { kind: "personal" as const }, hasSubmissions: false };
    const account = {
      current: {
        id: "me",
        kind: "personal" as const,
        name: "Personal",
        detail: "Jordan Hale",
        initials: "JH",
        current: true,
        underReview: false,
      },
      switcher: null,
    };
    const bars = (path: string) => {
      pathname = path;
      session = signedIn();
      return render(
        <>
          <BidBottomTabBar />
          <WorkspaceTabBar
            tabs={getClientMobileTabs(scope)}
            sections={getClientNavSections(scope)}
            account={account}
            pathname={path}
            counts={{ needsYou: {}, unread: 0 }}
          />
        </>,
      );
    };
    const inAccount = bars("/bids");
    expect(screen.queryByTestId("bid-bottom-tab-bar")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Bid, tabs" })).toBeInTheDocument();
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    inAccount.unmount();
  });
});
