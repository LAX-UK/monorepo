"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Strip OIDC logout `state` query noise from the signed-out landing URL. */
export function SignedOutUrlCleanup() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!searchParams.has("state")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("state");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
