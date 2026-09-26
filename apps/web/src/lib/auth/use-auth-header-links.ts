"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

function resolveHeaderAuthNext(pathname: string, search: string): string | null {
  const next = search ? `${pathname}?${search}` : pathname;
  return isSafeNextPath(next) ? next : null;
}

export { resolveHeaderAuthNext };

/** Login/register hrefs for header chrome, preserving safe `next` for the current page. */
export function useAuthHeaderLinks(): { signInHref: string; registerHref: string } {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return useMemo(() => {
    const next = resolveHeaderAuthNext(pathname, search);
    return {
      signInHref: buildHostedLoginStartHref({ next }),
      registerHref: buildHostedLoginStartHref({ next, intent: "signup" }),
    };
  }, [pathname, search]);
}
