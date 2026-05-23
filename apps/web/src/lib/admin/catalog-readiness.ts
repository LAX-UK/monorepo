import type { Lot, Sale } from "@auction/types";

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

export function buildLotPublishReadiness(
  lotId: string,
  auction: Lot,
  connectRequired = false,
): CatalogReadinessResult {
  const scheduleValid = auction.endTime.getTime() > auction.startTime.getTime();
  const items: CatalogReadinessItem[] = [
    {
      id: "images",
      label: "At least one image",
      ok: auction.images.length >= 1,
      severity: "required",
      href: `/admin/lots/${lotId}/images`,
    },
    {
      id: "description",
      label: "Catalogue description",
      ok: Boolean(auction.description?.trim()),
      severity: "required",
      href: `/admin/lots/${lotId}/edit`,
    },
    {
      id: "seller",
      label: connectRequired ? "Seller Connect account" : "Seller legal entity",
      ok: Boolean(auction.sellerLegalEntityId) && !connectRequired,
      severity: "required",
      href: `/admin/lots/${lotId}`,
    },
    {
      id: "artist",
      label: "Artist assigned / review cleared",
      ok: !auction.artistReviewRequired,
      severity: "required",
      href: `/admin/lots/${lotId}/edit`,
    },
    {
      id: "sale",
      label: "Assigned to a sale",
      ok: Boolean(auction.saleId),
      severity: "warning",
      href: `/admin/lots/${lotId}`,
    },
    {
      id: "schedule",
      label: "Valid schedule (end after start)",
      ok: scheduleValid,
      severity: "required",
      href: `/admin/lots/${lotId}/edit`,
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
      href: `/admin/sales/${saleId}/lots`,
    },
    {
      id: "schedule",
      label: "Sale schedule set",
      ok: scheduleValid,
      severity: "required",
      href: `/admin/sales/${saleId}/schedule`,
    },
    {
      id: "registrations",
      label: "Registrations reviewed",
      ok: !liveish || pendingRegistrationCount === 0,
      severity: "warning",
      href: `/admin/sales/${saleId}/registrations`,
    },
    {
      id: "venue",
      label: "Onsite venue details",
      ok: venueOk,
      severity: isOnsite ? "required" : "warning",
      href: `/admin/sales/${saleId}/edit`,
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
