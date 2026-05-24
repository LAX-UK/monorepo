"use client";

import type { ReactNode } from "react";
import { LotQuickLookProvider } from "./lot-quick-look-context";
import { LotQuickLookDialog } from "./lot-quick-look-dialog";

/** Mount once in the marketing layout — provides quick-look context + dialog portal. */
export function MarketingLotQuickLookShell({ children }: { children: ReactNode }) {
  return (
    <LotQuickLookProvider>
      {children}
      <LotQuickLookDialog />
    </LotQuickLookProvider>
  );
}
