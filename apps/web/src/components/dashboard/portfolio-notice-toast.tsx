"use client";

import { notify } from "@/lib/ui/notify";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function PortfolioNoticeToastInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    if (searchParams.get("notice") !== "not-winner") return;
    shown.current = true;
    notify.info("Checkout unavailable", {
      id: "portfolio-notice-not-winner",
      description: "That lot is not assigned to you as the winning bidder.",
    });
    const next = new URLSearchParams(searchParams.toString());
    next.delete("notice");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}

/** One-shot toast when redirected from checkout for a non-winning lot. */
export function PortfolioNoticeToast() {
  return (
    <Suspense fallback={null}>
      <PortfolioNoticeToastInner />
    </Suspense>
  );
}
