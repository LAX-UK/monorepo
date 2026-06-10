"use client";

import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function OrgSubmittedAlertInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stripped = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (stripped.current) return;
    if (searchParams.get("org_submitted") !== "1") return;
    stripped.current = true;
    setVisible(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("org_submitted");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  if (!visible) return null;

  return (
    <Alert
      className="mb-6 rounded-xl border-lot-orange/40 bg-surface-container-low/80 shadow-sm"
      variant="default"
      aria-live="polite"
    >
      <AlertTitle>Organisation submitted</AlertTitle>
      <AlertDescription className="text-on-surface">
        Your organisation is being reviewed. Check back here for status updates.
      </AlertDescription>
    </Alert>
  );
}

/** Shown after org onboarding submission; captures query param then strips URL while keeping the alert visible. */
export function OrgSubmittedAlert() {
  return (
    <Suspense fallback={null}>
      <OrgSubmittedAlertInner />
    </Suspense>
  );
}
