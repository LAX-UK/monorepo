"use client";

import type { ShopSilentFedcmBootstrapProps } from "@/lib/fedcm/resolve-silent-fedcm-props.server";
import { requestSilentFedcmCredential } from "@auction/identity-rp/silent-sign-in";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const SKIP_PREFIXES = [
  "/login",
  "/register",
  "/auth/",
  "/session-expired",
  "/account/disabled",
  "/api/",
];

const FEDCM_ATTEMPT_KEY = "lax_shop_fedcm_silent_attempt";

export function ShopSilentFedcmBootstrap({
  fedcm,
}: {
  fedcm: ShopSilentFedcmBootstrapProps | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!fedcm) return;
    if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    if (sessionStorage.getItem(FEDCM_ATTEMPT_KEY) === "1") return;

    sessionStorage.setItem(FEDCM_ATTEMPT_KEY, "1");

    void (async () => {
      const token = await requestSilentFedcmCredential(
        globalThis.navigator?.credentials as Parameters<typeof requestSilentFedcmCredential>[0],
        { configUrl: fedcm.configUrl, clientId: fedcm.clientId },
      );
      if (token) {
        const response = await fetch(`${fedcm.identityBaseUrl}/fedcm/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });
        if (response.ok) {
          globalThis.location.reload();
          return;
        }
      }
      const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      globalThis.location.assign(
        `${fedcm.identityBaseUrl}/auth/sso-probe?returnTo=${encodeURIComponent(returnTo)}`,
      );
    })();
  }, [fedcm, pathname, searchParams]);

  return null;
}
