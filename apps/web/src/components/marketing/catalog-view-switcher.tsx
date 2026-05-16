"use client";

import {
  type CatalogLayoutView,
  VIEW_COOKIE_MAX_AGE_SEC,
  viewCookieName,
} from "@/lib/preferences/view-cookie";
import { ViewSwitcher } from "@auction/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function CatalogViewSwitcher({
  routeKey,
  value,
  supportedModes,
}: {
  routeKey: string;
  value: CatalogLayoutView;
  supportedModes?: readonly CatalogLayoutView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (next: CatalogLayoutView) => {
      startTransition(() => {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("view", next);
        const qs = nextParams.toString();
        const secure = typeof window !== "undefined" && window.location.protocol === "https:";
        document.cookie = `${viewCookieName(routeKey)}=${next}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure ? "; Secure" : ""}`;
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, routeKey, searchParams],
  );

  return (
    <ViewSwitcher
      value={value}
      onValueChange={apply}
      {...(supportedModes !== undefined ? { modes: supportedModes } : {})}
      disabled={pending}
    />
  );
}
