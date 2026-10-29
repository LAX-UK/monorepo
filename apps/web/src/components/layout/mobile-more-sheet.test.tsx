import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/actions/user-ui-preferences", () => ({
  updateUiPreferencesAction: vi.fn(),
}));

vi.mock("@/lib/auth/use-refetch-app-session", () => ({
  useRefetchAppSession: () => async () => {},
}));

vi.mock("@/hooks/use-unread-notifications", () => ({
  useUnreadNotifications: () => ({ unread: 2 }),
}));

const FAMILY_LINKS = [
  { id: "art", label: "lax.art", href: "https://lax.art", current: false },
  { id: "shop", label: "lax.shop", href: "https://shop.lax.art", current: false },
  { id: "bid", label: "lax.bid", href: "https://lax.bid", current: true },
  {
    id: "account",
    label: "LAX Account",
    href: "https://account.lax.bid/account?from=bid",
    current: false,
  },
] as const;

describe("MobileMoreSheet", () => {
  it("renders profile strip for client users", () => {
    render(
      <MobileMoreSheet
        open
        onOpenChange={() => {}}
        variant="client"
        items={[]}
        user={{
          name: "Jane Doe",
          email: "jane@example.com",
          image: null,
        }}
        familyLinks={FAMILY_LINKS}
      />,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bid settings" })).toHaveAttribute("href", "/settings");
    // LAX Account is listed once, with the other LAX products.
    const accounts = screen.getAllByRole("link", { name: /LAX Account/ });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toHaveAttribute("href", "https://account.lax.bid/account?from=bid");
    expect(accounts[0]?.closest("nav")).toHaveAttribute("aria-label", "LAX products");
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Account settings" })).toBeNull();
  });

  it("uses accessible label for notifications with unread count", () => {
    render(
      <MobileMoreSheet
        open
        onOpenChange={() => {}}
        variant="client"
        items={[
          {
            id: "notifications",
            label: "Notifications",
            href: "/notifications",
            icon: Bell,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Notifications, 2 unread notifications" }),
    ).toBeInTheDocument();
  });
});
