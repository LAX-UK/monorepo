"use client";

import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import {
  overlayOutlineButtonClasses,
  overlayToneProps,
  saleroomHeroActionSizing,
} from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";
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
  loginNextPath: string;
  /** `outlined-block` — Figma saleroom hero: 40px height, square corners, #0A0A0A border.
   * `rounded` (default) — pill / existing marketing style.
   */
  appearance?: "rounded" | "outlined-block";
};

import { toggleSaleFollow } from "@/lib/data/http/sale-follow.client";

const outlinedBlockSizing = cn(saleroomHeroActionSizing, "min-w-[117px]");

const outlinedOnSurfaceClass = cn(
  outlinedBlockSizing,
  "border border-brand-800 bg-transparent text-brand-800 hover:bg-transparent hover:opacity-90 dark:border-on-surface/80 dark:text-on-surface",
);

export function SaleroomFollowToggle({
  saleId,
  initialFollowing,
  isAuthenticated,
  size = "lg",
  label,
  loginNextPath,
  appearance = "rounded",
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const inFrame = useOverlayToneContext() != null;
  const overlayTone = useOverlayTone("contentBlock");
  const outlinedClass =
    appearance === "outlined-block" && inFrame
      ? overlayOutlineButtonClasses(overlayTone, cn(outlinedBlockSizing, "justify-center gap-2.5"))
      : cn("inline-flex items-center justify-center gap-2.5", outlinedOnSurfaceClass);
  const outlinedToneProps =
    appearance === "outlined-block" && inFrame ? overlayToneProps(overlayTone) : {};

  const toggle = useCallback(async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      const ok = await toggleSaleFollow(saleId, following);
      if (ok) setFollowing(!following);
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
          className={cn(
            outlinedClass,
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand",
          )}
          {...outlinedToneProps}
        >
          <BellRing className="size-4 shrink-0" aria-hidden />
          {label ?? "Follow"}
        </Link>
      );
    }
    return (
      <Link
        href={`/login?next=${encodeURIComponent(loginNextPath)}`}
        className={`inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-high font-label font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:border-link hover:text-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${sizeClasses}`}
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
        className={cn(outlinedClass, following ? "bg-primary-container/20" : "")}
        {...outlinedToneProps}
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
      className={`h-auto rounded-full font-label font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${sizeClasses} ${
        following
          ? "bg-primary-container text-on-primary-container hover:bg-primary-container hover:opacity-95"
          : "border-outline-variant/60 bg-surface-container-high text-on-surface hover:border-link hover:bg-surface-container-high hover:text-link"
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
