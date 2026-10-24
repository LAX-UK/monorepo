"use client";

import { DensityProvider } from "@/components/layout/density-provider";
import { artistsPaletteSource } from "@/components/layout/palette/sources/artists-source";
import { clientsPaletteSource } from "@/components/layout/palette/sources/clients-source";
import { lotsPaletteSource } from "@/components/layout/palette/sources/lots-source";
import { paymentsPaletteSource } from "@/components/layout/palette/sources/payments-source";
import { salesPaletteSource } from "@/components/layout/palette/sources/sales-source";
import type { PaletteSource } from "@/components/layout/palette/types";
import { getStaffNavGroups } from "@/components/layout/staff-nav";
import { StaffRouteRecentTracker } from "@/components/layout/staff-route-recent-tracker";
import { syncUiThemeFromClientAction } from "@/lib/actions/user-ui-preferences";
import { useLogout } from "@/lib/auth/use-logout";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import { HotkeyProvider } from "@/lib/hotkeys/hotkey-provider";
import { StaffGlobalHotkeys } from "@/lib/hotkeys/staff-global-hotkeys";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { applyThemeDom } from "@/lib/preferences/apply-theme-dom";
import type { DashboardDensity } from "@/lib/preferences/density";
import { readThemeCookieFromDocument } from "@/lib/preferences/theme-cookie";
import { staffRoleLabel } from "@/lib/presenters/platform-role/platform-role-registry";
import type { ShellConfig } from "@/lib/shell/contracts";
import { ShellChromeProvider } from "@/lib/shell/shell-chrome-context";
import { ShellConfigProvider } from "@/lib/shell/shell-config-context";
import {
  AccountMenu,
  type StaffCommand,
  type StaffLinkComponent,
  StaffMenuItem,
  type StaffNavGroup,
  type StaffProduct,
  StaffShell,
  type StaffTheme,
} from "@auction/staff-ui";
import type { UserRole, UserStaffRole } from "@auction/types";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const NextLink: StaffLinkComponent = Link;

/** Record search in ⌘K, from the same sources the previous palette searched. */
const SEARCH_SOURCES: readonly PaletteSource[] = [
  lotsPaletteSource,
  salesPaletteSource,
  clientsPaletteSource,
  artistsPaletteSource,
  paymentsPaletteSource,
];

async function searchRecords(query: string): Promise<StaffCommand[]> {
  const results = await Promise.all(
    SEARCH_SOURCES.map(async (source) => {
      try {
        const items = await source.search(query);
        return items.slice(0, 5).map((item) => ({
          id: `${source.id}:${item.id}`,
          label: item.label,
          group: source.heading,
          href: item.href,
          ...(item.hint ? { hint: item.hint } : {}),
          ...(item.icon ? { icon: item.icon } : {}),
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

function toStaffNav(
  user: Pick<SessionUser, "role" | "staffRole">,
  pendingSubmissionCount: number,
  pendingArtistCount: number,
  navCounts: AdminNavCounts | undefined,
): StaffNavGroup[] {
  return getStaffNavGroups(
    user.role as UserRole,
    pendingSubmissionCount,
    (user.staffRole ?? null) as UserStaffRole | null,
    pendingArtistCount,
    navCounts,
  ).map((group) => ({
    id: group.id,
    ...(group.id === "overview" ? {} : { title: group.title }),
    items: group.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      ...(item.match ? { match: item.match } : {}),
      ...(item.badge
        ? {
            count: item.badge,
            countTone:
              item.badgeTone === "warning" ||
              item.badgeTone === "danger" ||
              item.badgeTone === "live"
                ? ("attention" as const)
                : ("neutral" as const),
          }
        : {}),
    })),
  }));
}

/**
 * Bid admin in the shared staff shell. The nav comes from the staff nav model, already filtered
 * to what this person's role can open; the providers pages rely on (shell config, density,
 * chrome) are kept so existing pages render unchanged inside the new frame.
 */
export function BidStaffFrame({
  user,
  config,
  products,
  cookieDensity,
  defaultCollapsed,
  children,
}: {
  user: SessionUser;
  config: ShellConfig;
  products: StaffProduct[];
  cookieDensity: DashboardDensity | null;
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const { logout } = useLogout();
  const [theme, setTheme] = useState<StaffTheme>("system");
  useEffect(() => setTheme(readThemeCookieFromDocument() ?? "system"), []);

  const navGroups = useMemo(
    () =>
      toStaffNav(
        user,
        config.pendingSubmissionCount ?? 0,
        config.pendingArtistCount ?? 0,
        config.navCounts,
      ),
    [user, config.pendingSubmissionCount, config.pendingArtistCount, config.navCounts],
  );
  const navigate = useCallback((href: string) => router.push(href), [router]);
  const current = products.find((product) => product.id === "bid-admin") ?? products[0];
  if (!current) throw new Error("Bid admin must be in the product list");

  return (
    <HotkeyProvider scope="page">
      <StaffGlobalHotkeys />
      <ShellConfigProvider config={config}>
        <ShellChromeProvider>
          <DensityProvider cookieDensity={cookieDensity}>
            <StaffRouteRecentTracker />
            <StaffShell
              product={current}
              products={products}
              navGroups={navGroups}
              pathname={pathname}
              Link={NextLink}
              navigate={navigate}
              search={searchRecords}
              defaultCollapsed={defaultCollapsed}
              // Bid admin's own hotkey help already answers "?".
              shortcutsHelp={false}
              {...(config.header.actionsSlot ? { topBarActions: config.header.actionsSlot } : {})}
              account={
                <AccountMenu
                  user={{
                    name: user.name || user.email,
                    email: user.email,
                    roleLabel: staffRoleLabel((user.staffRole ?? null) as UserStaffRole | null),
                  }}
                  theme={theme}
                  onThemeChange={(next) => {
                    applyThemeDom(next);
                    setTheme(next);
                    void syncUiThemeFromClientAction({ theme: next });
                  }}
                  onSignOut={() => void logout()}
                >
                  <StaffMenuItem asChild>
                    <a href={laxAccountUrl()}>
                      <UserRound aria-hidden />
                      LAX Account
                    </a>
                  </StaffMenuItem>
                </AccountMenu>
              }
            >
              {config.topSlot}
              {config.contextBanner ? <div className="mb-4">{config.contextBanner}</div> : null}
              {children}
            </StaffShell>
          </DensityProvider>
        </ShellChromeProvider>
      </ShellConfigProvider>
    </HotkeyProvider>
  );
}
