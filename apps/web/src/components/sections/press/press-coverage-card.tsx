import { PressCoverageCardActions } from "@/components/sections/press/press-coverage-card-actions";
import { PressCoverageCardMedia } from "@/components/sections/press/press-coverage-card-media";
import type { PressCoverageVM } from "@/components/sections/saleroom/view-models";
import { PullQuote } from "@/components/ui/pull-quote";
import { FOCUS_RING, MARKETING_CARD_LIFT, MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { getPressMentionTypeLabel } from "@/lib/marketing/press-params";
import { cn } from "@auction/ui";
import Link from "next/link";

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
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest hover:border-outline-variant/60",
        MARKETING_CARD_LIFT,
        className,
      )}
    >
      <PressCoverageCardMedia
        imageUrl={item.imageUrl}
        mentionType={item.mentionType}
        outletName={item.outletName}
        headline={item.headline}
      />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            {item.outletName}
          </span>
          {item.mentionType ? (
            <span className="shrink-0 rounded-full border border-outline-variant/30 px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-on-surface-variant/70">
              {getPressMentionTypeLabel(item.mentionType)}
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

          {item.excerpt ? <PullQuote>{item.excerpt}</PullQuote> : null}
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
            <PressCoverageCardActions
              url={item.url}
              headline={item.headline}
              outletName={item.outletName}
              dateLabel={item.dateLabel}
              publishedAt={item.publishedAt}
              shareClassName="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
