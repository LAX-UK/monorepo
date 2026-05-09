import { cn } from "@auction/ui";

type SoldStampProps = {
  /** When true, the stamp animates in (use after status flips to ended). */
  active: boolean;
  className?: string;
  /** Optional alternative caption. */
  label?: string;
};

/** F3c — SOLD stamp.
 *
 * Overlays a "Sold" mark on a lot card once the lot enters `ended` state.
 * The animation comes in once, slightly off-axis so it reads like an
 * inked stamp rather than a flat label. Respects `prefers-reduced-motion`
 * via the global cascade (animation collapses to none).
 */
export function SoldStamp({ active, className, label = "Sold" }: SoldStampProps) {
  if (!active) return null;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className,
      )}
    >
      <span className="sold-stamp-in inline-flex items-center justify-center rounded-sm border-[3px] border-live-red bg-white/90 px-5 py-1.5 font-headline text-2xl font-bold uppercase tracking-[0.16em] text-live-red shadow-md">
        {label}
      </span>
    </div>
  );
}
