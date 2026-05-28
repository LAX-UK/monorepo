import { buildShellConfig } from "@/lib/shell/build-shell-config";
import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BottomTabBar } from "./bottom-tab-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
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

function renderBottomTabBar() {
  const config = buildShellConfig({ user: clientUser, role: "client" });
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
    const overviewLink = screen.getByRole("link", { name: /overview/i });

    expect(moreButton.className).toMatch(/flex-col/);
    expect(moreButton.className).not.toMatch(/inline-flex/);
    expect(overviewLink.className).toMatch(/flex-col/);

    for (const tab of screen.getAllByRole("link")) {
      expect(tab.className).toMatch(/min-h-\[var\(--tap-target-min,44px\)\]/);
    }
    expect(moreButton.className).toMatch(/min-h-\[var\(--tap-target-min,44px\)\]/);
  });
});
