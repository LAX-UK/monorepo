"use client";

import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import {
  SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD,
  SITE_BUYERS_PREMIUM_STANDARD,
  SITE_BUYERS_PREMIUM_THRESHOLD,
} from "@/lib/brand";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";
import Link from "next/link";

type Tone = "light" | "dark";

type BuyersPremiumChipProps = {
  href?: string;
  /** Inline fallback when not inside AdaptiveMediaFrame. */
  tone?: Tone;
  className?: string;
  showThreshold?: boolean;
};

export function BuyersPremiumChip({
  href = "/terms#buyers-premium",
  tone = "light",
  className,
  showThreshold = false,
}: BuyersPremiumChipProps) {
  const inFrame = useOverlayToneContext() != null;
  const contentTone = useOverlayTone("contentBlock");

  const text = showThreshold
    ? `Excl. ${SITE_BUYERS_PREMIUM_STANDARD} buyer's premium · ${SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD} above ${SITE_BUYERS_PREMIUM_THRESHOLD}`
    : `Excl. ${SITE_BUYERS_PREMIUM_STANDARD} buyer's premium`;

  const inlinePalette =
    tone === "dark"
      ? "border-white/20 text-white/85 hover:border-white/40 hover:text-white"
      : "border-outline-variant/60 text-on-surface-variant hover:border-on-surface/40 hover:text-on-surface";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 font-label text-[11px] font-medium uppercase leading-3 tracking-[0.12em] transition-colors motion-reduce:transition-none",
        inFrame ? overlayPillClasses(contentTone) : inlinePalette,
        className,
      )}
      {...(inFrame ? overlayToneProps(contentTone) : {})}
    >
      <span aria-hidden>i</span>
      <span>{text}</span>
    </Link>
  );
}
