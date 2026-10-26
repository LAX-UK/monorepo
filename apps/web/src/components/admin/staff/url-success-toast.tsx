"use client";

import { notify } from "@/lib/ui/notify";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * A server action that redirects back with `?success=…` says so in a toast, once, and the param
 * leaves the URL so a reload or a shared link does not repeat it.
 */
export function UrlSuccessToast({
  message,
  param = "success",
}: { message: string | null; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    if (!message || shown.current === message) return;
    shown.current = message;
    notify.success(message);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(param);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [message, param, pathname, router, searchParams]);

  return null;
}
