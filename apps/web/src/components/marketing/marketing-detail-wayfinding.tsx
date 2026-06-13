import {
  MarketingBreadcrumb,
  type MarketingBreadcrumbItem,
} from "@/components/marketing/marketing-breadcrumb";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  backHref: string;
  backLabel: string;
  breadcrumbItems: readonly MarketingBreadcrumbItem[];
  /** Optional trailing controls aligned to the right of the back-link row (e.g. lot pager). */
  actions?: ReactNode;
  className?: string;
};

const backLinkClassName =
  "inline-flex min-h-11 items-center font-label text-[0.65rem] font-semibold uppercase tracking-[0.22em] underline-offset-4 text-on-surface-variant hover:text-link hover:underline md:min-h-0";

/** Back link + breadcrumb trail for marketing detail routes (artist profile, lot PDP, sale room, …). */
export function MarketingDetailWayfinding({
  backHref,
  backLabel,
  breadcrumbItems,
  actions,
  className,
}: Props) {
  return (
    <div className={cn("pt-4 md:pt-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <Link href={backHref} className={cn(FOCUS_RING, backLinkClassName)}>
          ← {backLabel}
        </Link>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <MarketingBreadcrumb
        items={breadcrumbItems}
        className="mt-3 font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant md:text-xs"
      />
    </div>
  );
}
