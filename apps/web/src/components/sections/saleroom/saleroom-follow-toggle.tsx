"use client";

import { Button } from "@auction/ui/components/button";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  saleId: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
  /** Optional size variant — "lg" is hero; default is compact. */
  size?: "sm" | "lg";
  /** Optional label override (e.g. for a hero CTA). */
  label?: string;
  loginNextPath?: string;
  /**
   * `outlined-block` — Figma saleroom hero: 40px height, square corners, #0A0A0A border.
   * `rounded` (default) — pill / existing marketing style.
   */
  appearance?: "rounded" | "outlined-block";
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

const outlinedClass =
  "box-border inline-flex h-10 min-w-[117px] items-center justify-center gap-2.5 rounded-[4px] border border-brand-800 bg-transparent px-8 font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-brand-800 hover:bg-transparent hover:opacity-90 dark:border-on-surface/80 dark:text-on-surface";

export function SaleroomFollowToggle({
  saleId,
  initialFollowing,
  isAuthenticated,
  size = "lg",
  label,
  loginNextPath = `/sales/${saleId}`,
  appearance = "rounded",
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      const url = `${apiBase()}/sales/${encodeURIComponent(saleId)}/follow`;
      const res = await fetch(url, {
        method: following ? "DELETE" : "POST",
        credentials: "include",
      });
      if (res.ok) setFollowing(!following);
    } finally {
      setBusy(false);
    }
  }, [saleId, busy, isAuthenticated, following]);

  const sizeClasses =
    size === "lg" ? "min-h-11 px-5 py-2.5 text-xs" : "min-h-9 px-3 py-1.5 text-[0.7rem]";

  if (!isAuthenticated) {
    if (appearance === "outlined-block") {
      return (
        <Link
          href={`/login?next=${encodeURIComponent(loginNextPath)}`}
          className={`${outlinedClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 dark:focus-visible:outline-on-surface`}
        >
          <BellRing className="size-4 shrink-0" aria-hidden />
          {label ?? "Follow"}
        </Link>
      );
    }
    return (
      <Link
        href={`/login?next=${encodeURIComponent(loginNextPath)}`}
        className={`inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-high font-label font-bold uppercase tracking-widest text-on-surface transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${sizeClasses}`}
      >
        <BellRing className="size-4" aria-hidden />
        {label ?? "Sign in to follow"}
      </Link>
    );
  }

  if (appearance === "outlined-block") {
    return (
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        aria-pressed={following}
        onClick={() => void toggle()}
        className={`${outlinedClass} ${following ? "bg-primary-container/20" : ""}`}
      >
        {following ? (
          <BellRing className="size-4 shrink-0" aria-hidden />
        ) : (
          <Bell className="size-4 shrink-0" aria-hidden />
        )}
        {label ? (following ? "Following" : label) : following ? "Following" : "Follow sale"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={following ? "secondary" : "outline"}
      disabled={busy}
      aria-pressed={following}
      onClick={() => void toggle()}
      className={`h-auto rounded-full font-label font-bold uppercase tracking-widest ${sizeClasses} ${
        following
          ? "bg-primary-container text-on-primary-container hover:bg-primary-container hover:opacity-95"
          : "border-outline-variant/60 bg-surface-container-high text-on-surface hover:border-primary hover:bg-surface-container-high hover:text-primary"
      }`}
    >
      {following ? (
        <BellRing className="size-4" aria-hidden />
      ) : (
        <Bell className="size-4" aria-hidden />
      )}
      {label ?? (following ? "Following" : "Follow sale")}
    </Button>
  );
}
