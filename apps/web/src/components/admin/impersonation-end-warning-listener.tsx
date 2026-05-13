"use client";

import { notify } from "@/lib/ui/notify";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function ImpersonationEndWarningListenerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    if (searchParams.get("impersonation_end_warning") !== "1") return;
    shown.current = true;
    notify.warning("Impersonation ended", {
      description:
        "We could not record the end of your support session in the audit log after several tries. You are no longer impersonating; if this persists, contact engineering.",
    });
    const next = new URLSearchParams(searchParams.toString());
    next.delete("impersonation_end_warning");
    const q = next.toString();
    router.replace(q ? `/admin?${q}` : "/admin");
  }, [router, searchParams]);

  return null;
}

/** Shows a toast when `?impersonation_end_warning=1` is present, then strips the param. */
export function ImpersonationEndWarningListener() {
  return (
    <Suspense fallback={null}>
      <ImpersonationEndWarningListenerInner />
    </Suspense>
  );
}
