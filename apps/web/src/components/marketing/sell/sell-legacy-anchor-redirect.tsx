"use client";

import { legacySellAnchorTarget } from "@/lib/marketing/sell-legacy-anchors";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * A fragment never reaches the server, so old links such as `/sell#photos` are moved in the
 * browser to the section's new page.
 */
export function SellLegacyAnchorRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = legacySellAnchorTarget(window.location.hash);
    if (target) router.replace(target);
  }, [router]);
  return null;
}
