"use client";

import { MaybeSaleroomLiveProvider } from "@/lib/context/saleroom-live-provider";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { ReactNode } from "react";

type Props = {
  saleId: string | null;
  initial: PublicSaleroomSessionStatus;
  children: ReactNode;
};

/** Wraps hybrid sale catalog with saleroom live subscription when saleId is set. */
export function SaleroomCatalogLiveShell({ saleId, initial, children }: Props) {
  return (
    <MaybeSaleroomLiveProvider saleId={saleId} initial={initial}>
      {children}
    </MaybeSaleroomLiveProvider>
  );
}
