"use client";

import { trackSilentSignInResult } from "@/lib/analytics/events";
import type { SilentFedcmBootstrapProps } from "@/lib/auth/fedcm/resolve-silent-fedcm-props.server";
import { BID_SILENT_SSO_SKIP_PREFIXES } from "@/lib/auth/silent-sign-in/config";
import { useAppSession } from "@/lib/auth/use-app-session";
import { requestSilentFedcmCredential } from "@auction/identity-rp/silent-sign-in";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const FEDCM_ATTEMPT_KEY = "lax_bid_fedcm_silent_attempt";

/** Chromium-only silent sign-in when redirect probes are skipped (FEDCM_ENABLED). */
export function SilentFedcmBootstrap({ fedcm }: { fedcm: SilentFedcmBootstrapProps | null }) {
  const { user, pending } = useAppSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!fedcm) return;
    if (user || pending) return;
    if (BID_SILENT_SSO_SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    if (sessionStorage.getItem(FEDCM_ATTEMPT_KEY) === "1") return;

    sessionStorage.setItem(FEDCM_ATTEMPT_KEY, "1");

    void (async () => {
      const token = await requestSilentFedcmCredential(
        globalThis.navigator?.credentials as Parameters<typeof requestSilentFedcmCredential>[0],
        { configUrl: fedcm.configUrl, clientId: fedcm.clientId },
      );
      if (token) {
        const response = await fetch("/api/auth/fedcm/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "same-origin",
        });
        if (response.ok) {
          trackSilentSignInResult({ strategy: "fedcm", outcome: "signed_in" });
          globalThis.location.reload();
          return;
        }
      }
      const next = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      globalThis.location.assign(`/api/auth/sso-probe?next=${encodeURIComponent(next)}`);
    })();
  }, [fedcm, user, pending, pathname, searchParams]);

  return null;
}
