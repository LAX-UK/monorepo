import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** The "See all" link at the top right of a Home section. */
export function HomeSeeAllLink({ href, label = "See all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-sm font-body text-sm font-medium text-on-surface underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
      <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
