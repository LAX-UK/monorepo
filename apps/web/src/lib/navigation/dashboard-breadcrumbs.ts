import type { SessionUser } from "@/lib/data/contracts";

export type Crumb = { label: string; href: string };

const collectorSegments: Record<string, string> = {
  dashboard: "Overview",
  submissions: "Sell",
  bids: "Bids",
  portfolio: "Portfolio",
  notifications: "Notifications",
  checkout: "Checkout",
  settings: "Settings",
  profile: "Profile",
  security: "Security",
  new: "New",
};

const adminSegments: Record<string, string> = {
  admin: "Admin",
  analytics: "Analytics",
  sales: "Sales",
  submissions: "Submissions",
  lots: "Lots",
  payments: "Payments",
  users: "Users",
  new: "New",
  edit: "Edit",
};

function labelForSegment(seg: string, isAdmin: boolean): string {
  const map = isAdmin ? adminSegments : collectorSegments;
  return map[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function breadcrumbsForPath(pathname: string, user: SessionUser): Crumb[] {
  const isAdmin = pathname.startsWith("/admin");
  const root = isAdmin ? "/admin" : "/dashboard";
  const rootLabel = isAdmin ? "Admin" : "Dashboard";
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return [{ label: rootLabel, href: root }];
  }

  const out: Crumb[] = [{ label: rootLabel, href: root }];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg) continue;
    acc += `/${seg}`;
    const isUuidLike = /^[0-9a-f-]{20,}$/i.test(seg);
    const label = isUuidLike ? "Details" : labelForSegment(seg, isAdmin);
    out.push({ label, href: acc });
  }
  return out;
}
