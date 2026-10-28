import { buildShellConfig } from "@/lib/shell/build-shell-config";
import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BottomTabBar } from "./bottom-tab-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    ...props
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-unread-notifications", () => ({
  useUnreadNotifications: () => ({
    items: [],
    setItems: () => {},
    loaded: true,
    unread: 0,
    refresh: async () => {},
  }),
}));

vi.mock("./mobile-more-sheet", () => ({
  MobileMoreSheet: () => null,
}));

const clientUser = {
  id: "user-1",
  email: "client@example.com",
  name: "Client User",
  role: "client" as const,
  staffRole: null,
};

const staffUser = { ...clientUser, id: "staff-1", role: "staff" as const, staffRole: null };

const SELLER_SCOPE = { context: { kind: "personal" as const }, hasSubmissions: true };

function renderBottomTabBar(config = buildShellConfig({ user: clientUser, role: "client" })) {
  return render(
    <ShellConfigProvider config={config}>
      <BottomTabBar user={clientUser} />
    </ShellConfigProvider>,
  );
}

describe("BottomTabBar", () => {
  it("aligns the More tab with the same flex-col layout as link tabs", () => {
    renderBottomTabBar();

    const moreButton = screen.getByRole("button", { name: /open more dashboard actions/i });
    const bidsLink = screen.getByRole("link", { name: /my bids/i });

    expect(moreButton.className).toMatch(/flex-col/);
    expect(moreButton.className).not.toMatch(/inline-flex/);
    expect(bidsLink.className).toMatch(/flex-col/);

    for (const tab of screen.getAllByRole("link")) {
      expect(tab.className).toMatch(/min-h-\[var\(--tap-target-min,44px\)\]/);
    }
    expect(moreButton.className).toMatch(/min-h-\[var\(--tap-target-min,44px\)\]/);
  });

  it("gives every tab, More included, the same 44px-minimum box and type", () => {
    renderBottomTabBar();
    const tabs = [
      ...screen.getAllByRole("link"),
      screen.getByRole("button", { name: /open more dashboard actions/i }),
    ];
    for (const tab of tabs) {
      expect(tab.className).toMatch(/min-w-\[var\(--tap-target-min,44px\)\]/);
      expect(tab.className).toContain("text-xs");
      expect(tab.className).toContain("[&_svg]:size-5");
      // The button's own padding, gap and 16px icon size must not survive the merge.
      expect(tab.className).not.toMatch(/\bpy-3\b|\bgap-2\b|\[&_svg\]:size-4|text-\[11px\]/);
    }
  });

  it("names the selling tab after the menu's Selling section, not Lots", () => {
    renderBottomTabBar(
      buildShellConfig({ user: clientUser, role: "client", clientNavScope: SELLER_SCOPE }),
    );
    const selling = screen.getByRole("link", { name: "Selling" });
    expect(selling).toHaveAttribute("href", "/selling/consignments");
    expect(screen.queryByText("Lots")).not.toBeInTheDocument();
  });

  it("uses the visible label as each tab's accessible name", () => {
    renderBottomTabBar(
      buildShellConfig({ user: clientUser, role: "client", clientNavScope: SELLER_SCOPE }),
    );
    for (const tab of screen.getAllByRole("link")) {
      expect(tab).toHaveAccessibleName(tab.textContent?.trim() ?? "");
    }
  });

  it("never gives staff the client tabs", () => {
    const config = buildShellConfig({ user: staffUser, role: "platform" });
    const ids = config.mobileNav.map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const clientId of ["bids", "purchases", "watchlist", "consignments", "payouts"]) {
      expect(ids).not.toContain(clientId);
    }
  });
});
