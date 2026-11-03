"use client";

import { ConsentBar } from "@/components/marketing/consent/consent-bar";
import { ConsentPreferencesDialog } from "@/components/marketing/consent/consent-dialog";
import { CookieDock } from "@/components/marketing/consent/cookie-dock";
import { showsConsentBanner } from "@/lib/analytics/consent/surfaces";
import { usePathname } from "next/navigation";

/**
 * Client bundle for the cookie dock (banner, plus the slot for the lot page's phone bar) and the
 * settings dialog, mounted from the root layout. Staff routes never render it: Bid admin is a
 * work tool, not a consumer page.
 */
export function ConsentShell() {
  const pathname = usePathname();
  if (!showsConsentBanner(pathname)) return null;
  return (
    <>
      <CookieDock>
        <ConsentBar />
      </CookieDock>
      <ConsentPreferencesDialog />
    </>
  );
}
