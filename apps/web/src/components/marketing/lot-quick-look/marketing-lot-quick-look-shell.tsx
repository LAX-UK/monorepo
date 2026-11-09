"use client";

import { type ReactNode, useEffect, useState } from "react";
import { LotQuickLookProvider, useLotQuickLook } from "./lot-quick-look-context";
import { LazyLotQuickLookDialog } from "./lot-quick-look-dialog.lazy";

/**
 * Mounts the dialog once a quick look has been opened, and keeps it mounted afterwards so it can
 * play its closing motion and open again without a second fetch.
 */
function QuickLookDialogMount() {
  const { session } = useLotQuickLook();
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (session) setRequested(true);
  }, [session]);
  return requested ? <LazyLotQuickLookDialog /> : null;
}

/** Mount once in the marketing layout — provides quick-look context + dialog portal. */
export function MarketingLotQuickLookShell({ children }: { children: ReactNode }) {
  return (
    <LotQuickLookProvider>
      {children}
      <QuickLookDialogMount />
    </LotQuickLookProvider>
  );
}
