import {
  categoryDetailTabHref,
  categoryEditHref,
} from "@/components/admin/category-detail/category-detail-types";
import {
  lotDetailTabHref,
  lotEditCatalogHref,
  lotEditHref,
} from "@/components/admin/lot-detail/lot-detail-types";
import { saleDetailTabHref, saleEditHref } from "@/components/admin/sale-detail/sale-detail-types";
import { readinessLabel } from "@/lib/admin/sale-setup/field-copy";
import type { AdminCategory, ArtistProfile, Lot, Sale } from "@auction/types";
import { lotTimingViolationAgainstSale, saleModeInheritsLotTiming } from "@auction/validators";

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

export function buildLotPublishReadiness(
  lotId: string,
  auction: Lot,
  context: LotPublishReadinessContext = {},
): CatalogReadinessResult {
  const connectRequired = context.connectRequired ?? false;
  const scheduleValid = auction.endTime.getTime() > auction.startTime.getTime();
  const saleWindowOk =
    !context.sale || !auction.saleId || lotFitsSaleWindowForPublish(auction, context.sale);

  const items: CatalogReadinessItem[] = [
    {
      id: "images",
      label: "At least one image",
      ok: auction.images.length >= 1,
      severity: "required",
      href: lotDetailTabHref(lotId, "images"),
    },
    {
      id: "description",
      label: "Catalogue description",
      ok: Boolean(auction.description?.trim()),
      severity: "required",
      href: lotEditCatalogHref(lotId),
    },
    {
      id: "seller",
      label: connectRequired ? readinessLabel("connect") : "Seller legal entity",
      ok: Boolean(auction.sellerLegalEntityId) && !connectRequired,
      severity: "required",
      href: lotDetailTabHref(lotId, "overview"),
    },
    {
      id: "artist",
      label: "Artist assigned / review cleared",
      ok: !auction.artistReviewRequired,
      severity: "required",
      href: lotEditHref(lotId),
    },
    {
      id: "sale",
      label: "Assigned to a sale",
      ok: Boolean(auction.saleId),
      severity: "warning",
      href: lotDetailTabHref(lotId, "overview"),
    },
    {
      id: "sale-window",
      label: "Lot schedule fits sale window",
      ok: saleWindowOk,
      severity: "required",
      href: lotEditHref(lotId),
    },
    {
      id: "schedule",
      label: "Valid schedule (end after start)",
      ok: scheduleValid,
      severity: "required",
      href: lotEditHref(lotId),
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

export function buildSalePublishReadiness(
  saleId: string,
  sale: Sale,
  lotCount: number,
  pendingRegistrationCount: number | null,
): CatalogReadinessResult {
  const hasLots = lotCount >= 1;
  const scheduleValid = sale.endTime.getTime() > sale.startTime.getTime();
  const liveish = sale.status === "scheduled" || sale.status === "active";
  const isOnsite = sale.deliveryMode === "onsite";
  const venueOk =
    !isOnsite ||
    Boolean(
      sale.locationName?.trim() ||
        sale.locationAddress?.trim() ||
        sale.locationAddressLine1?.trim(),
    );

  const items: CatalogReadinessItem[] = [
    {
      id: "lots",
      label: "At least one lot attached",
      ok: hasLots,
      severity: "required",
      href: saleDetailTabHref(saleId, "lots"),
    },
    {
      id: "schedule",
      label: "Sale schedule set",
      ok: scheduleValid,
      severity: "required",
      href: saleDetailTabHref(saleId, "schedule"),
    },
    {
      id: "registrations",
      label: "Registrations reviewed",
      ok: !liveish || pendingRegistrationCount === 0,
      severity: "warning",
      href: saleDetailTabHref(saleId, "registrations"),
    },
    {
      id: "venue",
      label: "Onsite venue details",
      ok: venueOk,
      severity: isOnsite ? "required" : "warning",
      href: saleEditHref(saleId),
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
