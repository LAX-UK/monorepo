"use client";

import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function OrgSubmittedAlertInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    if (searchParams.get("org_submitted") !== "1") return;
    cleared.current = true;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("org_submitted");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <Alert
      className="mb-6 rounded-xl border-lot-orange/40 bg-surface-container-low/80 shadow-sm"
      variant="default"
    >
      <AlertTitle>Organisation submitted</AlertTitle>
      <AlertDescription className="text-on-surface">
        Your organisation is being reviewed. We&apos;ll notify you when approved.
      </AlertDescription>
    </Alert>
  );
}

/** Shown after org onboarding submission (query param); clears the param after first paint. */
export function OrgSubmittedAlert() {
  return (
    <Suspense fallback={null}>
      <OrgSubmittedAlertInner />
    </Suspense>
  );
}
