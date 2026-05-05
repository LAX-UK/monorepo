"use client";

import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function WelcomeBackToastInner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("welcome") === "back") {
      setVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <output
      className="fixed bottom-6 left-1/2 z-[60] block w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-lg bg-inverse-surface px-5 py-4 text-inverse-on-surface shadow-lg"
      aria-live="polite"
    >
      <p className="mb-3 font-body text-sm">You&apos;re signed in. Continue where you left off.</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary"
        >
          Dashboard
        </Link>
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 py-0 font-label text-xs uppercase tracking-widest text-inverse-on-surface/70 underline hover:text-inverse-on-surface"
          onClick={() => setVisible(false)}
        >
          Dismiss
        </Button>
      </div>
    </output>
  );
}

export function WelcomeBackToast() {
  return (
    <Suspense fallback={null}>
      <WelcomeBackToastInner />
    </Suspense>
  );
}
