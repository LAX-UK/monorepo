import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { getStaffNavGroups } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import type { UserRole } from "@auction/types";

const marketingSections: PaletteSection[] = [
  {
    id: "pages",
    heading: "Pages",
    items: [
      { id: "m-upcoming", href: "/", label: "Upcoming auctions", hint: "Home" },
      { id: "m-search", href: "/search", label: "Search lots" },
      { id: "m-archive", href: "/archive", label: "Past auctions" },
      { id: "m-artists", href: "/artists", label: "Browse artists" },
    ],
  },
];

const dashboardBuyingSections: PaletteSection[] = [
  {
    id: "pages",
    heading: "Pages",
    items: [
      { id: "d-home", href: "/dashboard", label: "Dashboard home" },
      { id: "d-portfolio", href: "/dashboard/portfolio", label: "My collection" },
      { id: "d-bids", href: "/dashboard/bids", label: "My bids" },
      { id: "d-watchlist", href: "/dashboard/watchlist", label: "Watchlist" },
      { id: "d-gallery", href: "/", label: "Browse gallery", hint: "Marketing site" },
      { id: "d-search", href: "/search", label: "Search lots" },
    ],
  },
];

const dashboardSellingSections: PaletteSection[] = [
  {
    id: "seller",
    heading: "Selling workspace",
    items: [
      { id: "s-overview", href: "/dashboard/seller", label: "Seller overview" },
      { id: "s-submissions", href: "/dashboard/submissions", label: "My submissions" },
      { id: "s-in-sale", href: "/dashboard/seller/in-sale", label: "Items in sale" },
      { id: "s-payouts", href: "/dashboard/seller/payouts", label: "Sold & payouts" },
      { id: "s-connect", href: "/dashboard/seller/connect", label: "Payout setup" },
      { id: "s-artist", href: "/dashboard/seller/artist", label: "Artist profile" },
      { id: "s-search", href: "/search", label: "Search lots" },
    ],
  },
];

function buildStaffAdminPaletteSections(
  sessionUser: SessionUser,
  pendingSubmissionCount: number,
  pendingArtistCount = 0,
): PaletteSection[] {
  const role = sessionUser.role as UserRole;
  const groups = getStaffNavGroups(
    role,
    pendingSubmissionCount,
    sessionUser.staffRole ?? null,
    pendingArtistCount,
  );
  const fromNav: PaletteSection[] = groups.map((g) => ({
    id: g.id,
    heading: g.title,
    items: g.items.map((it) => ({
      id: `sn-${it.id}`,
      href: it.href,
      label: it.label,
    })),
  }));
  const shortcuts: PaletteSection = {
    id: "shortcuts",
    heading: "Shortcuts",
    items: [
      { id: "sn-new-sale", href: "/admin/sales/new", label: "New sale" },
      { id: "sn-new-lot", href: "/admin/lots/new", label: "New lot" },
      { id: "sn-new-artist", href: "/admin/artists/new", label: "New artist" },
      { id: "sn-submissions", href: "/admin/submissions", label: "Submissions queue" },
      { id: "sn-clients", href: "/admin/clients", label: "Clients" },
      { id: "sn-new-category", href: "/admin/categories/new", label: "New category" },
      {
        id: "sn-manual-review",
        href: "/admin/payments?manualReview=1",
        label: "Manual review queue",
      },
      { id: "sn-settlement", href: "/admin/payouts/settlement", label: "Manual settlement" },
      { id: "sn-saleroom", href: "/admin/saleroom", label: "Saleroom hub" },
      { id: "sn-impersonate", href: "/admin/impersonation", label: "Impersonate user" },
      ...(pendingArtistCount > 0
        ? [
            {
              id: "sn-pending-artists",
              href: "/admin/artists?status=pending",
              label: "Pending artists",
              hint: `${pendingArtistCount} pending`,
            } satisfies PaletteItem,
          ]
        : [
            {
              id: "sn-pending-artists",
              href: "/admin/artists?status=pending",
              label: "Pending artists",
            } satisfies PaletteItem,
          ]),
      { id: "sn-gallery", href: "/", label: "Exit to gallery", hint: "Marketing site" },
    ],
  };
  return [...fromNav, shortcuts];
}

function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const t = query.trim().toLowerCase();
  if (!t) return items;
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(t) ||
      (item.hint?.toLowerCase().includes(t) ?? false) ||
      (item.keywords?.toLowerCase().includes(t) ?? false),
  );
}

export function buildNavPaletteSections(
  variant: "marketing" | "dashboard" | "admin",
  query: string,
  sessionUser?: SessionUser | null,
  clientWorkspaceMode: ClientWorkspaceMode = "buying",
  pendingSubmissionCount = 0,
  pendingArtistCount = 0,
): PaletteSection[] {
  const base =
    variant === "dashboard"
      ? clientWorkspaceMode === "selling"
        ? dashboardSellingSections
        : dashboardBuyingSections
      : variant === "admin" && sessionUser
        ? buildStaffAdminPaletteSections(sessionUser, pendingSubmissionCount, pendingArtistCount)
        : variant === "admin"
          ? []
          : marketingSections;
  const out: PaletteSection[] = [];
  for (const sec of base) {
    const items = filterItems(sec.items, query);
    if (items.length > 0) out.push({ ...sec, items });
  }
  return out;
}
