import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
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
      />,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bid settings" })).toHaveAttribute("href", "/settings");
    const account = screen.getByRole("link", { name: /LAX Account/ });
    expect(account).toHaveAttribute("href", laxAccountHomeUrl());
    expect(account).toHaveTextContent("Manage your LAX Account: profile, security, addresses");
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
