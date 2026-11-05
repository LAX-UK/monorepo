import { SiteHeader } from "@/components/layout/site-header";
import type { BidAttention } from "@/hooks/use-bid-attention";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let attention: BidAttention;

vi.mock("@/lib/auth/use-app-session", () => ({
  useAppSession: () => ({ user: null, pending: false }),
}));

vi.mock("@/hooks/use-bid-attention", () => ({ useBidAttention: () => attention }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/layout/header-mega-nav", () => ({
  HeaderMegaNav: ({
    logo,
    trailing,
  }: {
    logo: React.ReactNode;
    trailing: React.ReactNode;
  }) => (
    <nav aria-label="Primary">
      {logo}
      {trailing}
    </nav>
  ),
}));

vi.mock("@/components/layout/header-search", () => ({
  HeaderSearchTrigger: ({ layout }: { layout: string }) => (
    <button type="button" data-testid={`search-${layout}`}>
      Search
    </button>
  ),
}));

vi.mock("@/components/layout/bid-header-account", () => ({
  BidHeaderAccount: () => (
    <button type="button" data-testid="account-entry">
      Account
    </button>
  ),
}));

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Switch to dark theme</button>,
}));

vi.mock("@/components/layout/bid-phone-menu", () => ({
  BidPhoneMenu: ({ open }: { open: boolean }) => (open ? <dialog open>Menu</dialog> : null),
}));

vi.mock("@/components/marketing/chrome-icon-button", async () => {
  const { forwardRef } = await import("react");
  return {
    ChromeIconButton: forwardRef<
      HTMLButtonElement,
      { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
    >(function ChromeIconButton({ label, children, ...rest }, ref) {
      return (
        <button type="button" ref={ref} aria-label={label} {...rest}>
          {children}
        </button>
      );
    }),
  };
});

const FAMILY: LaxFamilyLinkVm[] = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "bid", label: "lax.bid", href: "/", current: true },
  { id: "account", label: "LAX Account", href: "https://account.lax.art", current: false },
];

const GUEST: BidAttention = {
  signedIn: false,
  viewer: null,
  pending: false,
  attention: null,
  chip: null,
};
const OUTBID: BidAttention = {
  signedIn: true,
  viewer: { displayName: "Jordan Hale", email: "jordan@example.com" },
  pending: false,
  attention: null,
  chip: {
    kind: "payment-due",
    label: "Payment due",
    href: "/purchases",
    accessibleName: "Payment due. Go to Purchases",
  },
};

beforeEach(() => {
  attention = GUEST;
});

describe("SiteHeader", () => {
  it("uses the Bid lockup: mark and .BID tag on phones (28px), the full lockup from 1024px (40px)", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    const lockups = screen.getAllByRole("img", { hidden: true, name: "LAX Bid" });
    expect(lockups).toHaveLength(2);
    const [phone, desktop] = lockups;
    expect(phone?.getAttribute("class")).toContain("h-7");
    expect(phone?.getAttribute("class")).toContain("lg:hidden");
    expect(desktop?.getAttribute("class")).toContain("h-10");
    expect(desktop?.getAttribute("class")).toContain("lg:block");
    // Not the gavel-only short mark image.
    expect(document.querySelector('img[src*="logo-short"]')).toBeNull();
    expect(screen.getByRole("link", { name: "LAX Bid home" })).toHaveAttribute("href", "/");
  });

  it("makes the main row the slim 56px bar up to a tablet and 72px on a desktop", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    const row = screen.getByRole("navigation", { name: "Primary" }).parentElement;
    expect(row?.className).toContain("h-14");
    expect(row?.className).not.toContain("md:h-16");
    expect(row?.className).toContain("lg:h-[72px]");
  });

  it("shows About us, Contact us and FAQ as the top bar's help links", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    const help = within(screen.getByRole("navigation", { name: "Help" }));
    expect(help.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "About us",
      "Contact us",
      "FAQ",
    ]);
  });

  it("lets the 36px top bar scroll away while the main row stays", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("lg:translate-y-[calc(var(--lax-top-bar-shift,0px)*-1)]");
    expect(screen.getByTestId("lax-family-bar").className).toContain("min-h-9");
    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        expect(header.style.getPropertyValue("--lax-top-bar-shift")).toBe("36px");
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
        resolve();
      }),
    );
  });

  it("puts search, theme, account and the menu in the row, in that order", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    const slots = screen.getByTestId("top-bar-slots");
    expect(Array.from(slots.children).map((slot) => slot.getAttribute("data-slot"))).toEqual([
      "search-field",
      "search-icon",
      "product-action",
      "account",
      "menu",
    ]);
    const theme = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(theme.closest("[data-slot]")?.getAttribute("data-slot")).toBe("product-action");
    expect(screen.getByTestId("search-pill").closest("[data-slot]")).toHaveAttribute(
      "data-slot",
      "search-field",
    );
    expect(screen.getByTestId("search-icon").closest("[data-slot]")).toHaveAttribute(
      "data-slot",
      "search-icon",
    );
  });

  it("keeps the theme control out of the row below 1024px (the menu holds it)", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    const theme = screen.getByRole("button", { name: /switch to dark theme/i });
    expect(theme.parentElement?.className).toContain("hidden");
    expect(theme.parentElement?.className).toContain("lg:flex");
  });

  it("shows only the menu button and the lockup on a phone: the account entry is hidden below 768px", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    expect(screen.getByTestId("account-entry").closest("[data-slot]")?.className).toContain(
      "hidden md:block",
    );
    const menu = screen.getByRole("button", { name: "Open menu" });
    expect(menu.closest("[data-slot]")).toHaveAttribute("data-slot", "menu");
    expect(menu.className).toContain("lg:hidden");
  });

  it("opens the phone menu from the menu button", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("keeps the transparent header over a hero: white text and a white lockup, phones too", () => {
    render(<SiteHeader chromeVariant="transparentUntilScroll" familyLinks={FAMILY} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-header-tone", "on-dark");
    expect(header.className).toContain("bg-transparent");
    expect(screen.getByTestId("bid-header-lockup").className).toContain("text-hero-foreground");
  });

  it("uses the page tone for the lockup on a solid header", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    expect(screen.getByRole("banner")).toHaveAttribute("data-header-tone", "on-light");
    expect(screen.getByTestId("bid-header-lockup").className).toContain("text-on-surface");
  });
});

describe("SiteHeader attention prompt", () => {
  it("shows nothing when nothing is pressing", () => {
    render(<SiteHeader familyLinks={FAMILY} />);
    expect(screen.queryByTestId("attention-strip")).toBeNull();
    expect(screen.queryByTestId("attention-chip")).toBeNull();
  });

  it("is a strip under the bar below 640px and a chip in the row from 640px, one link each", () => {
    attention = OUTBID;
    render(<SiteHeader familyLinks={FAMILY} />);
    const strips = screen.getAllByTestId("attention-strip");
    const row = screen.getByRole("navigation", { name: "Primary" }).parentElement;
    // The visible strip is the one under the row: it follows the row in the document.
    const underBar = strips.find((strip) => strip.closest('[data-placement="strip"]'));
    expect(underBar).toBeTruthy();
    expect(underBar?.closest('[data-placement="strip"]')?.className).toContain("sm:hidden");
    expect(
      (row as Node).compareDocumentPosition(underBar as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(underBar).toHaveTextContent("Payment due");
    expect(underBar).toHaveTextContent("Pay now");
    expect(underBar).toHaveAttribute("href", "/purchases");
    const inRow = screen
      .getAllByTestId("attention-chip")
      .find((chip) => chip.closest('[data-placement="bar"]'));
    expect(inRow?.closest('[data-placement="bar"]')?.className).toContain("max-sm:hidden");
    expect(row?.contains(inRow as Node)).toBe(true);
  });
});
