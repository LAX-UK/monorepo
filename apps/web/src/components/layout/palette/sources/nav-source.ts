import { mapStaffNavGroupsToPaletteSections } from "@/components/layout/palette/palette-nav-mapper";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import { getStaffNavGroups } from "@/components/layout/staff-nav";
import type { SessionUser } from "@/lib/data/contracts";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import {
  ARTISTS_ACCESS,
  FINANCE_ACCESS,
  SALEROOM_ACCESS,
  SALE_CATALOG_ACCESS,
  SUBMISSIONS_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import {
  buildClientBuyingPaletteSections,
  buildClientSellingPaletteSections,
} from "@/lib/shell/client-nav-palette";
import type { ShellRole } from "@/lib/shell/contracts";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { type UserRole, type UserStaffRole, userHasAccessTo } from "@auction/types";
import {
  Brush,
  ExternalLink,
  MonitorPlay,
  Package,
  ScrollText,
  Upload,
  WalletCards,
} from "lucide-react";

const marketingSections: PaletteSection[] = [
  {
    id: "pages",
    heading: "Pages",
    items: [
      { id: "m-upcoming", href: "/", label: "Upcoming auctions", hint: "Home", kind: "page" },
      { id: "m-search", href: "/search", label: "Search lots", kind: "page" },
      { id: "m-archive", href: "/archive", label: "Past auctions", kind: "page" },
      { id: "m-artists", href: "/artists", label: "Browse artists", kind: "page" },
    ],
  },
];

type QuickActionSpec = {
  id: string;
  href: string;
  label: string;
  icon: NonNullable<PaletteItem["icon"]>;
  keywords?: string;
  requirement?: Parameters<typeof userHasAccessTo>[2];
  financeOnly?: boolean;
  platformOnly?: boolean;
};

const QUICK_ACTION_SPECS: QuickActionSpec[] = [
  {
    id: "qa-new-sale",
    href: "/admin/sales/new",
    label: "New sale",
    icon: ScrollText,
    requirement: SALE_CATALOG_ACCESS,
    platformOnly: true,
  },
  {
    id: "qa-new-lot",
    href: "/admin/lots/new",
    label: "New lot",
    icon: Package,
    requirement: SALE_CATALOG_ACCESS,
    platformOnly: true,
  },
  {
    id: "qa-submissions",
    href: "/admin/submissions",
    label: "Submissions queue",
    icon: Upload,
    requirement: SUBMISSIONS_ACCESS,
    platformOnly: true,
  },
  {
    id: "qa-manual-review",
    href: "/admin/payments?manualReview=1",
    label: "Manual review queue",
    icon: WalletCards,
    requirement: FINANCE_ACCESS,
  },
  {
    id: "qa-settlement",
    href: "/admin/payouts/settlement",
    label: "Run settlement",
    icon: WalletCards,
    requirement: FINANCE_ACCESS,
    financeOnly: true,
  },
  {
    id: "qa-saleroom",
    href: "/admin/saleroom",
    label: "Saleroom hub",
    icon: MonitorPlay,
    requirement: SALEROOM_ACCESS,
    platformOnly: true,
  },
  {
    id: "qa-pending-artists",
    href: "/admin/artists?status=pending",
    label: "Pending artists",
    icon: Brush,
    requirement: ARTISTS_ACCESS,
    platformOnly: true,
  },
  {
    id: "qa-gallery",
    href: "/",
    label: "Exit to gallery",
    icon: ExternalLink,
  },
];

function buildStaffAdminPaletteSections(
  sessionUser: SessionUser,
  pendingSubmissionCount: number,
  pendingArtistCount = 0,
  navCounts?: AdminNavCounts,
): PaletteSection[] {
  const role = sessionUser.role as UserRole;
  const staffRole = (sessionUser.staffRole ?? null) as UserStaffRole | null;
  const groups = getStaffNavGroups(
    role,
    pendingSubmissionCount,
    staffRole,
    pendingArtistCount,
    navCounts,
  );
  return mapStaffNavGroupsToPaletteSections(groups);
}

export function buildQuickActionsSection(
  sessionUser: SessionUser,
  shellRole: ShellRole,
  pendingArtistCount = 0,
): PaletteSection {
  const role = sessionUser.role as UserRole;
  const staffRole = (sessionUser.staffRole ?? null) as UserStaffRole | null;
  const isFinanceShell = shellRole === "finance";

  const items: PaletteItem[] = [];
  for (const spec of QUICK_ACTION_SPECS) {
    if (spec.platformOnly && isFinanceShell) continue;
    if (spec.financeOnly && !isFinanceShell) continue;
    if (spec.requirement && !userHasAccessTo(role, staffRole, spec.requirement)) continue;
    if (spec.id === "qa-pending-artists" && pendingArtistCount <= 0) continue;

    const item: PaletteItem = {
      id: spec.id,
      href: spec.href,
      label: spec.label,
      icon: spec.icon,
      kind: "shortcut",
      hint: "Quick action",
    };
    if (spec.keywords) item.keywords = spec.keywords;
    if (spec.id === "qa-pending-artists") {
      item.badge = pendingArtistCount;
      item.hint = `${pendingArtistCount} pending`;
    }
    if (spec.id === "qa-gallery") {
      item.hint = "Marketing site";
    }
    items.push(item);
    if (items.length >= 6) break;
  }

  return {
    id: "quick-actions",
    heading: "Quick actions",
    items,
  };
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
  orgModuleEnabled = true,
  navCounts?: AdminNavCounts,
): PaletteSection[] {
  const base =
    variant === "dashboard"
      ? clientWorkspaceMode === "selling"
        ? buildClientSellingPaletteSections(orgModuleEnabled)
        : buildClientBuyingPaletteSections(orgModuleEnabled)
      : variant === "admin" && sessionUser
        ? buildStaffAdminPaletteSections(
            sessionUser,
            pendingSubmissionCount,
            pendingArtistCount,
            navCounts,
          )
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
