import {
  SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD,
  SITE_BUYERS_PREMIUM_STANDARD,
  SITE_BUYERS_PREMIUM_THRESHOLD,
} from "@/lib/brand";
import { cn } from "@auction/ui";
import Link from "next/link";

type Tone = "light" | "dark";

type BuyersPremiumChipProps = {
  /** Where to send the user for full fee disclosure. Defaults to terms anchor. */
  href?: string;
  /** Visual tone — `dark` for placement over imagery (white text). */
  tone?: Tone;
  className?: string;
  /** When true, includes the threshold tier ("10% above £500,000"). */
  showThreshold?: boolean;
};

/** Buyer's premium disclosure chip (A3).
 *
 * Compact link reading e.g. `Excl. 15% buyer's premium`. Reads from the
 * `brand.ts` constants (single source) so a fee change is one-place.
 */
export function BuyersPremiumChip({
  href = "/terms#buyers-premium",
  tone = "light",
  className,
  showThreshold = false,
}: BuyersPremiumChipProps) {
  const text = showThreshold
    ? `Excl. ${SITE_BUYERS_PREMIUM_STANDARD} buyer's premium · ${SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD} above ${SITE_BUYERS_PREMIUM_THRESHOLD}`
    : `Excl. ${SITE_BUYERS_PREMIUM_STANDARD} buyer's premium`;

  const palette =
    tone === "dark"
      ? "border-white/20 text-white/85 hover:border-white/40 hover:text-white"
      : "border-outline-variant/60 text-on-surface-variant hover:border-on-surface/40 hover:text-on-surface";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 font-label text-[11px] font-medium uppercase leading-3 tracking-[0.12em] transition-colors motion-reduce:transition-none",
        palette,
        className,
      )}
    >
      <span aria-hidden>i</span>
      <span>{text}</span>
    </Link>
  );
}
