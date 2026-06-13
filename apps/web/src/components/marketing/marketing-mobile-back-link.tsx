import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  href: string;
  label: string;
  className?: string;
  /** Light text for immersive hero overlays. */
  variant?: "default" | "overlay";
};

/** Compact mobile-only back link for marketing detail routes. */
export function MarketingMobileBackLink({ href, label, className, variant = "default" }: Props) {
  return (
    <div className={cn("md:hidden", className)}>
      <Link
        href={href}
        className={cn(
          "inline-flex min-h-11 items-center font-label text-[0.65rem] font-semibold uppercase tracking-[0.22em] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          variant === "overlay"
            ? "text-white/70 hover:text-white hover:underline focus-visible:outline-white"
            : "text-on-surface-variant hover:text-link hover:underline focus-visible:outline-ring",
        )}
      >
        ← {label}
      </Link>
    </div>
  );
}
