import {
  categoryDetailTabHref,
  categoryEditHref,
} from "@/lib/admin/categories/category-detail-routes";
import {
  lotDetailTabHref,
  lotEditCatalogHref,
  lotEditHref,
} from "@/lib/admin/lots/lot-detail-routes";
import { readinessLabel } from "@/lib/admin/sale-setup/field-copy";
import { saleDetailTabHref, saleEditHref } from "@/lib/admin/sales/sale-detail-routes";
import { evaluateLotReadiness, evaluateSalePublishReadiness } from "@auction/domain";
import type { AdminCategory, ArtistProfile, Lot, Sale } from "@auction/types";
import {
  isOnsiteLocationReadyForPublish,
  isStartInFutureForPublish,
  lotTimingViolationAgainstSale,
  saleModeInheritsLotTiming,
} from "@auction/validators";

export type CatalogReadinessItem = {
  id: string;
  label: string;
  ok: boolean;
  severity: "required" | "warning";
  href?: string;
};

export type CatalogReadinessResult = {
  items: CatalogReadinessItem[];
  completeCount: number;
  totalCount: number;
  percent: number;
  firstFailing?: CatalogReadinessItem;
};

function pct(complete: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((complete / total) * 100);
}

export type LotPublishReadinessContext = {
  connectRequired?: boolean;
  sale?: Pick<Sale, "deliveryMode" | "startTime" | "endTime"> | null;
};

/** Onsite lots inherit sale timing at publish; API coerces drift — do not block readiness. */
export function lotFitsSaleWindowForPublish(
  lot: Pick<Lot, "startTime" | "endTime">,
  sale: Pick<Sale, "deliveryMode" | "startTime" | "endTime">,
): boolean {
  if (saleModeInheritsLotTiming(sale.deliveryMode)) {
    return true;
  }
  return (
    lotTimingViolationAgainstSale(
      {
        deliveryMode: sale.deliveryMode,
        startTime: sale.startTime,
        endTime: sale.endTime,
      },
      lot.startTime,
      lot.endTime,
    ) == null
  );
}

export function lotPublishRequiredBlockers(result: CatalogReadinessResult): CatalogReadinessItem[] {
  return result.items.filter((item) => item.severity === "required" && !item.ok);
}

export function lotPublishBlockedReason(result: CatalogReadinessResult): string | null {
  const first = lotPublishRequiredBlockers(result)[0];
  return first?.label ?? null;
}

/** Deep-link to the first incomplete publish check, or lot edit root. */
export function lotEditResumeHref(lotId: string, readiness: CatalogReadinessResult): string {
  return readiness.firstFailing?.href ?? lotEditHref(lotId);
}

const LOT_READINESS_HREFS = (lotId: string) =>
  ({
    images: lotDetailTabHref(lotId, "images"),
    description: lotEditCatalogHref(lotId),
    seller: lotDetailTabHref(lotId, "overview"),
    artist: lotEditHref(lotId),
    sale: lotDetailTabHref(lotId, "overview"),
    schedule: lotEditHref(lotId),
  }) as const;

export function buildLotPublishReadiness(
  lotId: string,
  auction: Lot,
  context: LotPublishReadinessContext = {},
): CatalogReadinessResult {
  const connectRequired = context.connectRequired ?? false;
  const saleWindowOk =
    !context.sale || !auction.saleId || lotFitsSaleWindowForPublish(auction, context.sale);
  const hrefs = LOT_READINESS_HREFS(lotId);
  const core = evaluateLotReadiness({ ...auction, connectRequired });

  const items: CatalogReadinessItem[] = core.checks.map((check) => ({
    id: check.id,
    label: check.id === "seller" && connectRequired ? readinessLabel("connect") : check.label,
    ok: check.ok,
    severity: check.severity,
    href: hrefs[check.id as keyof typeof hrefs],
  }));

  const saleIndex = items.findIndex((item) => item.id === "sale");
  const saleWindowItem: CatalogReadinessItem = {
    id: "sale-window",
    label: "Lot schedule fits sale window",
    ok: saleWindowOk,
    severity: "required",
    href: lotEditHref(lotId),
  };
  if (saleIndex >= 0) {
    items.splice(saleIndex + 1, 0, saleWindowItem);
  } else {
    items.push(saleWindowItem);
  }

  const completeCount = items.filter((i) => i.ok).length;
  const firstFailing = items.find((i) => !i.ok);

  return {
    items,
    completeCount,
    totalCount: items.length,
    percent: pct(completeCount, items.length),
    ...(firstFailing ? { firstFailing } : {}),
  };
}

export function buildSalePublishReadiness(
  saleId: string,
  sale: Sale,
  lotCount: number,
  pendingRegistrationCount: number | null,
): CatalogReadinessResult {
  const coreChecks = evaluateSalePublishReadiness({
    sale,
    lotCount,
    pendingRegistrationCount,
    venueReady: isOnsiteLocationReadyForPublish(sale),
    startInFuture: isStartInFutureForPublish(sale.startTime),
  });

  const items: CatalogReadinessItem[] = coreChecks.map((check) => ({
    id: check.id,
    label:
      check.id === "lots"
        ? "At least one lot attached"
        : check.id === "schedule"
          ? "Sale schedule set"
          : check.id === "registrations"
            ? "Registrations reviewed"
            : check.id === "venue"
              ? "Onsite venue details"
              : "Opening time must be in the future",
    ok: check.ok,
    severity: check.severity,
    href:
      check.id === "lots"
        ? saleDetailTabHref(saleId, "lots")
        : check.id === "schedule" || check.id === "sale_start_future"
          ? saleDetailTabHref(saleId, "schedule")
          : check.id === "registrations"
            ? saleDetailTabHref(saleId, "registrations")
            : saleEditHref(saleId),
  }));

  const completeCount = items.filter((i) => i.ok).length;
  const firstFailing = items.find((i) => !i.ok);

  return {
    items,
    completeCount,
    totalCount: items.length,
    percent: pct(completeCount, items.length),
    ...(firstFailing ? { firstFailing } : {}),
  };
}

export function buildArtistProfileReadiness(
  artistId: string,
  artist: ArtistProfile,
): CatalogReadinessResult {
  const items: CatalogReadinessItem[] = [
    {
      id: "bio",
      label: "Profile description",
      ok: Boolean(artist.shortBio?.trim() || artist.longBio?.trim()),
      severity: "warning",
      href: `/admin/artists/${artistId}/edit`,
    },
    {
      id: "kind",
      label: "Artist kind",
      ok: Boolean(artist.kind),
      severity: "warning",
      href: `/admin/artists/${artistId}/edit`,
    },
    {
      id: "review",
      label: "Review status",
      ok: artist.status !== "pending",
      severity: "warning",
      href: `/admin/artists/${artistId}/review`,
    },
  ];

  const completeCount = items.filter((i) => i.ok).length;
  const firstFailing = items.find((i) => !i.ok);

  return {
    items,
    completeCount,
    totalCount: items.length,
    percent: pct(completeCount, items.length),
    ...(firstFailing ? { firstFailing } : {}),
  };
}

export function buildCategoryTaxonomyReadiness(
  categoryId: string,
  category: AdminCategory,
  directChildCount: number,
): CatalogReadinessResult {
  const items: CatalogReadinessItem[] = [
    {
      id: "description",
      label: "Category description",
      ok: Boolean(category.description?.trim()),
      severity: "warning",
      href: categoryEditHref(categoryId),
    },
    {
      id: "hero",
      label: "Hero image",
      ok: Boolean(category.heroImageKey),
      severity: "warning",
      href: categoryEditHref(categoryId),
    },
    {
      id: "archive",
      label: "Not archived while in use",
      ok: !category.archived || category.usage.total === 0,
      severity: "warning",
      href: categoryEditHref(categoryId),
    },
    {
      id: "branch",
      label: "Branch has lots or children",
      ok: category.usage.lots > 0 || directChildCount > 0 || category.usage.total === 0,
      severity: "warning",
      href: categoryDetailTabHref(categoryId, "lots"),
    },
  ];

  const completeCount = items.filter((i) => i.ok).length;
  const firstFailing = items.find((i) => !i.ok);

  return {
    items,
    completeCount,
    totalCount: items.length,
    percent: pct(completeCount, items.length),
    ...(firstFailing ? { firstFailing } : {}),
  };
}
