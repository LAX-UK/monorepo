import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Props = Omit<ComponentProps<typeof Link>, "children"> & {
  /** Screen-reader context after “View all” (e.g. “auctions and sales”). */
  srSuffix?: string;
  children?: ReactNode;
};

/** Canonical home-rail “View all” chevron link — one label, one layout. */
export function MarketingViewAllLink({
  srSuffix,
  children = "View all",
  className,
  ...linkProps
}: Props) {
  return (
    <Button variant="chevron" asChild>
      <Link
        {...linkProps}
        className={
          className ??
          "inline-flex items-center gap-[11px] py-[18px] text-base font-semibold leading-6 tracking-[0.05em] text-on-surface"
        }
      >
        <span>{children}</span>
        {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
        <ChevronRight className="size-5 shrink-0" aria-hidden />
      </Link>
    </Button>
  );
}
