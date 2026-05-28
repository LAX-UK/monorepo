import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import {
  type AppShellRole,
  getRouteLabel,
  getRouteParentLabel,
} from "@/components/layout/app-shell-nav";
import { settingsSectionLabel } from "@/lib/navigation/settings-section-labels";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

const CLIENT_SEGMENT_LABELS: Record<string, string> = {
  "verify-identity": "Verify identity",
  checkout: "Checkout",
  organisations: "Organisations",
  invitations: "Invitations",
  settings: "Settings",
  seller: "Seller",
  submissions: "Submissions",
  portfolio: "Collection",
  payments: "My payments",
  watchlist: "Watchlist",
  bids: "My Bids",
  "artist-follow": "Followed artists",
  notifications: "Notifications",
};

function inferClientParentHref(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "dashboard") return undefined;

  const section = segments[1];
  if (!section) return "/dashboard";

  if (section === "settings" && segments.length > 2) {
    return "/dashboard/settings";
  }
  if (section === "organisations" && segments.length > 2) {
    return "/dashboard/organisations";
  }
  if (section === "checkout" && segments.length > 2) {
    return "/dashboard/portfolio";
  }
  if (section === "seller" && segments.length > 2) {
    return "/dashboard/seller";
  }

  const navHref = `/dashboard/${section}`;
  return navHref === pathname ? "/dashboard" : navHref;
}

function resolveClientCurrentLabel(pathname: string, workspace: ClientWorkspaceMode): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "Dashboard";

  const section = segments[1] ?? "";
  if (segments.length === 2) {
    return CLIENT_SEGMENT_LABELS[section] ?? getRouteLabel(pathname, "client", workspace);
  }

  if (section === "organisations" && segments.length === 3) return "Organisation";
  if (section === "checkout" && segments.length === 3) return "Checkout";
  if (section === "submissions" && segments.length === 3) return "Submission";
  if (section === "seller" && segments.length === 3) {
    const sellerLeaf: Record<string, string> = {
      connect: "Payout setup",
      payouts: "Sold & payouts",
      "in-sale": "Items in sale",
      artist: "Artist profile",
    };
    const sub = segments[2] ?? "";
    if (sellerLeaf[sub]) return sellerLeaf[sub];
  }
  if (section === "settings" && segments.length >= 3) {
    const leaf = segments[segments.length - 1] ?? "settings";
    return settingsSectionLabel(leaf);
  }

  const fromNav = getRouteLabel(pathname, "client", workspace);
  if (fromNav !== "Detail") return fromNav;

  return CLIENT_SEGMENT_LABELS[section] ?? "Detail";
}

/** Human-readable breadcrumb trail for signed-in client dashboard routes. */
export function buildClientBreadcrumbTrail(
  pathname: string,
  clientWorkspaceMode: ClientWorkspaceMode = "buying",
): BreadcrumbItem[] {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  const parent = getRouteParentLabel(pathname, "client" as AppShellRole, clientWorkspaceMode);
  const current = resolveClientCurrentLabel(pathname, clientWorkspaceMode);

  const items: BreadcrumbItem[] = [{ label: "Dashboard", href: "/dashboard" }];

  if (parent && parent !== current && parent !== "Dashboard") {
    const parentHref = inferClientParentHref(pathname);
    if (parentHref) {
      items.push({ label: parent, href: parentHref });
    } else {
      items.push({ label: parent });
    }
  }

  if (current && current !== "Dashboard") {
    items.push({ label: current });
  }

  return items;
}
