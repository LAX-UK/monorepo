import {
  findPaletteItemByHref,
  findPaletteItemById,
} from "@/components/layout/palette/palette-item-presenter";
import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { ShellRole } from "@/lib/shell/contracts";
import { Banknote, ScrollText, WalletCards } from "lucide-react";

const SUGGESTED_CAP = 6;

const FINANCE_SUGGESTED_HREFS = [
  "/admin/finance",
  "/admin/payments",
  "/admin/payments?manualReview=1",
  "/admin/payouts",
  "/admin/disputes",
] as const;

const FINANCE_HUB_ITEM: PaletteItem = {
  id: "sn-finance-hub",
  href: "/admin/finance",
  label: "Finance",
  icon: WalletCards,
  kind: "page",
  hint: "Hub",
};

type BuildSuggestedInput = {
  shellRole: ShellRole;
  navSections: readonly PaletteSection[];
  navCounts: AdminNavCounts;
  pendingSubmissionCount: number;
};

function pickItems(
  navSections: readonly PaletteSection[],
  picks: readonly { href?: string; id?: string; fallback?: PaletteItem }[],
): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const pick of picks) {
    const found =
      (pick.href ? findPaletteItemByHref(navSections, pick.href) : undefined) ??
      (pick.id ? findPaletteItemById(navSections, pick.id) : undefined) ??
      pick.fallback;
    if (found) items.push(found);
  }
  return items;
}

function buildFinanceSuggested(
  navSections: readonly PaletteSection[],
  navCounts: AdminNavCounts,
): PaletteItem[] {
  const picks: { href?: string; fallback?: PaletteItem }[] = [
    { href: "/admin/finance", fallback: FINANCE_HUB_ITEM },
    { href: "/admin/payments" },
  ];
  if (navCounts.manualReviewCount > 0) {
    picks.push({ href: "/admin/payments?manualReview=1" });
  }
  picks.push({ href: "/admin/payouts" }, { href: "/admin/disputes" });

  const items = pickItems(navSections, picks);
  const seen = new Set(items.map((item) => item.href));
  for (const href of FINANCE_SUGGESTED_HREFS) {
    if (items.length >= SUGGESTED_CAP) break;
    if (seen.has(href)) continue;
    const found = findPaletteItemByHref(navSections, href);
    if (found) {
      items.push(found);
      seen.add(href);
    }
  }
  return items.slice(0, SUGGESTED_CAP);
}

function buildPlatformSuggested(
  navSections: readonly PaletteSection[],
  pendingSubmissionCount: number,
): PaletteItem[] {
  const items: PaletteItem[] = [];
  const dashboard = findPaletteItemByHref(navSections, "/admin");
  if (dashboard) items.push(dashboard);

  if (pendingSubmissionCount > 0) {
    const submissions = findPaletteItemById(navSections, "sn-submissions");
    if (submissions) items.push(submissions);
  }

  const badgeItems = navSections
    .flatMap((section) => section.items)
    .filter((item) => (item.badge ?? 0) > 0)
    .sort((a, b) => (b.badge ?? 0) - (a.badge ?? 0));

  for (const item of badgeItems) {
    if (items.length >= SUGGESTED_CAP) break;
    if (items.some((existing) => existing.href === item.href)) continue;
    items.push(item);
  }

  if (items.length < SUGGESTED_CAP) {
    const saleroom = findPaletteItemById(navSections, "sn-saleroom");
    if (saleroom && !items.some((item) => item.href === saleroom.href)) {
      items.push(saleroom);
    }
  }

  return items.slice(0, SUGGESTED_CAP);
}

export function buildSuggestedSection(input: BuildSuggestedInput): PaletteSection | null {
  const items =
    input.shellRole === "finance"
      ? buildFinanceSuggested(input.navSections, input.navCounts)
      : buildPlatformSuggested(input.navSections, input.pendingSubmissionCount);

  if (items.length === 0) return null;

  return {
    id: "suggested",
    heading: "Suggested",
    items,
  };
}

/** Fallback quick-action icons when not resolved from nav. */
export const QUICK_ACTION_FALLBACK_ICONS = {
  newSale: ScrollText,
  settlement: Banknote,
} as const;
