"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import { cn } from "@auction/ui";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Signed-in header chip linking to bids closing within 24 hours. */
export function HeaderBidUrgencyChip({ className }: { className?: string }) {
  const { user } = useAppSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    void fetch("/api/me/bids/closing-soon", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((body: { count?: number }) => {
        if (!cancelled) setCount(typeof body.count === "number" ? body.count : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || count <= 0) return null;

  const label = count === 1 ? "1 lot closing" : `${count > 9 ? "9+" : count} lots closing`;

  return (
    <Link
      href="/dashboard/bids?tab=active"
      className={cn(
        "inline-flex min-h-[var(--tap-target-min,44px)] items-center gap-1.5 rounded-full border border-lot-orange/40 bg-lot-orange/10 px-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-lot-orange transition-colors hover:bg-lot-orange/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:px-3.5 lg:text-xs",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0 lg:size-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{count > 9 ? "9+" : count}</span>
    </Link>
  );
}
