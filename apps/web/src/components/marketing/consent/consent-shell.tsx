"use client";

import { ConsentBar } from "@/components/marketing/consent/consent-bar";
import { ConsentPreferencesDialog } from "@/components/marketing/consent/consent-dialog";
import { showsConsentBanner } from "@/lib/analytics/consent/surfaces";
import { usePathname } from "next/navigation";

/**
 * Client bundle for cookie banner + preferences dialog (mounted from root layout). Staff routes
 * never render it: Bid admin is a work tool, not a consumer page.
 */
export function ConsentShell() {
  const pathname = usePathname();
  if (!showsConsentBanner(pathname)) return null;
  return (
    <>
      <ConsentBar />
      <ConsentPreferencesDialog />
    </>
  );
}
