import type { PressCoverageVM } from "@/components/sections/saleroom/view-models";
import { FOCUS_RING, MARKETING_CARD_LIFT, MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

export const PRESS_MENTION_TYPE_LABELS: Record<
  NonNullable<PressCoverageVM["mentionType"]>,
  string
> = {
  feature: "Feature",
  interview: "Interview",
  quote: "Quote",
  roundup: "Roundup",
};

type SaleContext = {
  href: string;
  title: string;
};

type Props = {
  item: PressCoverageVM;
  saleContext?: SaleContext;
  className?: string;
};

/** Shared press coverage card used on sale pages and the /press hub. */
export function PressCoverageCard({ item, saleContext, className }: Props) {
  return (
    <article
      className={cn(
        "group flex h-full flex-col gap-3 rounded-xl border border-border-hairline bg-surface-container-lowest p-5 hover:border-outline-variant/60",
        MARKETING_CARD_LIFT,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          {item.outletName}
        </span>
        {item.mentionType ? (
          <span className="shrink-0 rounded-full border border-outline-variant/30 px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-on-surface-variant/70">
            {PRESS_MENTION_TYPE_LABELS[item.mentionType]}
          </span>
        ) : null}
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("flex flex-1 flex-col gap-3 focus-visible:outline-none", FOCUS_RING)}
        aria-label={`Read "${item.headline}" on ${item.outletName} (opens in new tab)`}
      >
        <p className="font-headline text-base font-semibold leading-snug text-on-surface group-hover:text-link">
          {item.headline}
        </p>

        {item.excerpt ? (
          <p className="line-clamp-3 font-body text-sm leading-relaxed text-on-surface-variant">
            &ldquo;{item.excerpt}&rdquo;
          </p>
        ) : null}
      </a>

      <div className="mt-auto flex flex-col gap-2 border-t border-border-hairline pt-3">
        {saleContext ? (
          <p className="font-body text-xs text-on-surface-variant">
            From{" "}
            <Link href={saleContext.href} className={MARKETING_PROSE_LINK}>
              {saleContext.title}
            </Link>
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-xs text-on-surface-variant/60">{item.domain}</span>
          <div className="flex items-center gap-1.5">
            {item.dateLabel ? (
              <time
                dateTime={item.publishedAt ?? undefined}
                className="font-body text-xs text-on-surface-variant/60"
              >
                {item.dateLabel}
              </time>
            ) : null}
            <ExternalLinkIcon
              className="size-3.5 text-on-surface-variant/50 transition-colors group-hover:text-link"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </article>
  );
}
