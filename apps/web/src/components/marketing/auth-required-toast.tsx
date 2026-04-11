"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AuthToastInner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("auth") === "required") {
      setVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[60] w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-lg bg-inverse-surface px-5 py-4 text-inverse-on-surface shadow-lg"
      role="status"
    >
      <p className="mb-3 font-body text-sm">
        Sign in to access your dashboard and place bids.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/login?next=/dashboard&auth=required"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-[10px] font-bold uppercase tracking-widest text-on-primary"
        >
          Sign in
        </Link>
        <button
          type="button"
          className="font-label text-[10px] uppercase tracking-widest text-inverse-on-surface/70 underline"
          onClick={() => setVisible(false)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function AuthRequiredToast() {
  return (
    <Suspense fallback={null}>
      <AuthToastInner />
    </Suspense>
  );
}
