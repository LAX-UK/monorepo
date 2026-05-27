"use client";

import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import type { Lot } from "@auction/types";
import { useSearchParams } from "next/navigation";

type Props = {
  lots: readonly Pick<Lot, "id" | "sellerLegalEntityId">[];
  connectRequiredByLotId?: Record<string, boolean>;
};

function saleHasProactiveConnectBlock(
  lots: readonly Pick<Lot, "id">[],
  connectRequiredByLotId?: Record<string, boolean>,
): boolean {
  if (!connectRequiredByLotId) return false;
  return lots.some((lot) => connectRequiredByLotId[lot.id]);
}

function firstBlockedSellerId(
  lots: readonly Pick<Lot, "id" | "sellerLegalEntityId">[],
  connectRequiredByLotId?: Record<string, boolean>,
): string | null {
  if (!connectRequiredByLotId) return null;
  for (const lot of lots) {
    if (connectRequiredByLotId[lot.id]) {
      return lot.sellerLegalEntityId ?? null;
    }
  }
  return null;
}

/** Global connect notice for all sale detail tabs (proactive + reactive error_code). */
export function SaleDetailConnectNotice({ lots, connectRequiredByLotId }: Props) {
  const searchParams = useSearchParams();
  const reactiveConnect = searchParams.get("error_code") === "connect_required";
  const proactiveConnectRequired = saleHasProactiveConnectBlock(lots, connectRequiredByLotId);
  const show = proactiveConnectRequired || reactiveConnect;
  if (!show) return null;

  const detail =
    reactiveConnect && !proactiveConnectRequired
      ? safeDecodeAdminErrorParam(searchParams.get("error"))
      : null;

  return (
    <AdminLotConnectRequiredBanner
      sellerLegalEntityId={firstBlockedSellerId(lots, connectRequiredByLotId)}
      detail={detail}
    />
  );
}
