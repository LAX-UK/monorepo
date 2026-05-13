"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** After successful email verification, auto-navigate to the next destination. */
export function VerifyEmailSuccessRedirect({
  href,
  delayMs = 2000,
}: {
  href: string;
  delayMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setTimeout(() => {
      router.replace(href);
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [href, delayMs, router]);

  return (
    <output className="block font-footer-links text-sm text-on-surface-variant" aria-live="polite">
      Taking you to your next step in a moment…
    </output>
  );
}
