"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ConsentPreferencesDialog = dynamic(
  () =>
    import("@/components/marketing/consent/consent-dialog").then((mod) => ({
      default: mod.ConsentPreferencesDialog,
    })),
  { ssr: false },
);

/**
 * Mounts the cookie settings dialog the first time it is asked for, and keeps it mounted so it
 * can play its closing motion and open again. Until then none of its code is downloaded.
 */
export function ConsentPreferencesMount() {
  const { preferencesOpen } = useConsent();
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (preferencesOpen) setRequested(true);
  }, [preferencesOpen]);
  return requested ? <ConsentPreferencesDialog /> : null;
}
