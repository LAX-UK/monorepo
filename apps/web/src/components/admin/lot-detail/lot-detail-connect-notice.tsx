"use client";

import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { useSearchParams } from "next/navigation";

type Props = {
  sellerLegalEntityId: string | null;
  /** Proactive server-side Connect block from layout. */
  proactiveConnectRequired: boolean;
};

/** Global connect notice for all lot detail tabs (proactive + reactive error_code). */
export function LotDetailConnectNotice({ sellerLegalEntityId, proactiveConnectRequired }: Props) {
  const searchParams = useSearchParams();
  const reactiveConnect = searchParams.get("error_code") === "connect_required";
  const show = proactiveConnectRequired || reactiveConnect;
  if (!show) return null;

  const detail =
    reactiveConnect && !proactiveConnectRequired
      ? safeDecodeAdminErrorParam(searchParams.get("error"))
      : null;

  return (
    <AdminLotConnectRequiredBanner sellerLegalEntityId={sellerLegalEntityId} detail={detail} />
  );
}
