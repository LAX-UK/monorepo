"use client";

import type { AdminNavGroup, AdminNavIcon } from "@/server/domain/admin-nav.vm";
import {
  AccountMenu,
  type StaffLinkComponent,
  type StaffNavGroup,
  type StaffProduct,
  StaffShell,
  type StaffTheme,
  type StaffUser,
  applyStaffTheme,
} from "@auction/staff-ui";
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  Factory,
  FileText,
  FileUser,
  Handshake,
  Image,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Moon,
  Newspaper,
  PackageCheck,
  PanelsTopLeft,
  Receipt,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  Sun,
  Tag,
  Timer,
  UserPlus,
  Users,
  Wallet,
} from "@auction/staff-ui/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  artworks: Image,
  artists: Users,
  applications: FileUser,
  exhibitions: PanelsTopLeft,
  stories: Newspaper,
  venues: MapPin,
  pages: FileText,
  help: CircleHelp,
  placements: BookOpen,
  featured: Star,
  enquiries: Inbox,
  products: ShoppingBag,
  orders: Receipt,
  production: Factory,
  fulfilment: PackageCheck,
  holds: Timer,
  originalSales: Tag,
  thirdPartySales: Handshake,
  requests: ClipboardList,
  clients: Users,
  leads: UserPlus,
  payouts: Wallet,
  disputes: ShieldAlert,
  staff: ShieldCheck,
  audit: ScrollText,
  settings: Settings,
};

const NextLink: StaffLinkComponent = Link;

function toStaffNav(groups: AdminNavGroup[]): StaffNavGroup[] {
  return groups.map((group) => ({
    id: group.title.toLowerCase().replace(/\W+/g, "-"),
    ...(group.items.length === 1 && group.items[0]?.label === group.title
      ? {}
      : { title: group.title }),
    items: group.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: ICONS[item.icon],
      ...(item.attentionCount
        ? { count: item.attentionCount, countTone: "attention" as const }
        : {}),
    })),
  }));
}

/**
 * Binds the staff shell to LAX Admin: the Next router, the session's nav, the theme cookie and
 * sign out. The pathname comes from the client router, not the request, because the staff layout
 * persists across client navigations and would otherwise keep highlighting the first page.
 */
export function ShopAdminShell({
  navGroups,
  products,
  user,
  initialTheme,
  defaultCollapsed,
  children,
}: {
  navGroups: AdminNavGroup[];
  products: StaffProduct[];
  user: StaffUser;
  initialTheme: StaffTheme;
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<StaffTheme>(initialTheme);
  const staffNav = useMemo(() => toStaffNav(navGroups), [navGroups]);
  const navigate = useCallback((href: string) => router.push(href), [router]);
  const current = products.find((product) => product.id === "lax-admin") ?? products[0];
  if (!current) throw new Error("LAX Admin must be in the product list");

  return (
    <StaffShell
      product={current}
      products={products}
      navGroups={staffNav}
      pathname={usePathname()}
      Link={NextLink}
      navigate={navigate}
      defaultCollapsed={defaultCollapsed}
      commands={[
        {
          id: "theme:toggle",
          label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
          group: "Preferences",
          icon: theme === "dark" ? Sun : Moon,
          onSelect: () => {
            const next = theme === "dark" ? "light" : "dark";
            applyStaffTheme(next);
            setTheme(next);
          },
        },
      ]}
      account={
        <AccountMenu
          user={user}
          theme={theme}
          onThemeChange={(next) => {
            applyStaffTheme(next);
            setTheme(next);
          }}
          onSignOut={() => {
            const form = document.createElement("form");
            form.method = "post";
            form.action = "/api/auth/logout";
            document.body.append(form);
            form.submit();
          }}
        />
      }
    >
      {children}
    </StaffShell>
  );
}
