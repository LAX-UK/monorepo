import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  href: string;
  label: string;
  className?: string;
};

/** Compact mobile-only back link for marketing detail routes. */
export function MarketingMobileBackLink({ href, label, className }: Props) {
  return (
    <div className={cn("md:hidden", className)}>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center font-label text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-on-surface-variant underline-offset-4 hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        ← {label}
      </Link>
    </div>
  );
}
