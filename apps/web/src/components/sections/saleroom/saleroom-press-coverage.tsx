import type { PressCoverageVM } from "@/components/sections/saleroom/view-models";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { ExternalLinkIcon } from "lucide-react";

type Props = {
  items: PressCoverageVM[];
  className?: string;
};

const MENTION_TYPE_LABELS: Record<NonNullable<PressCoverageVM["mentionType"]>, string> = {
  feature: "Feature",
  interview: "Interview",
  quote: "Quote",
  roundup: "Roundup",
};

/**
 * Public press coverage section (server component — no client state).
 * External links use rel="noopener noreferrer" only: these are curated editorial
 * endorsements so we intentionally pass link equity (no nofollow).
 */
export function SaleroomPressCoverage({ items, className }: Props) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-1">
        <h2 className="font-headline text-2xl font-semibold text-on-surface">Press coverage</h2>
        <p className="font-body text-sm text-on-surface-variant">
          Coverage from the press and media.
        </p>
      </div>

      <ol
        className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Press coverage articles"
      >
        {items.map((item, index) => (
          <li key={`${item.url}-${index}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex h-full flex-col gap-3 rounded-xl border border-border-hairline bg-surface-container-lowest p-5 transition-shadow hover:border-outline-variant/60 hover:shadow-sm",
                FOCUS_RING,
              )}
              aria-label={`Read "${item.headline}" on ${item.outletName} (opens in new tab)`}
            >
              {/* Outlet + type badge row */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {item.outletName}
                </span>
                {item.mentionType ? (
                  <span className="shrink-0 rounded-full border border-outline-variant/30 px-2 py-0.5 font-label text-[10px] uppercase tracking-wider text-on-surface-variant/70">
                    {MENTION_TYPE_LABELS[item.mentionType]}
                  </span>
                ) : null}
              </div>

              {/* Headline */}
              <p className="flex-1 font-headline text-base font-semibold leading-snug text-on-surface group-hover:text-link">
                {item.headline}
              </p>

              {/* Excerpt */}
              {item.excerpt ? (
                <p className="line-clamp-3 font-body text-sm leading-relaxed text-on-surface-variant">
                  &ldquo;{item.excerpt}&rdquo;
                </p>
              ) : null}

              {/* Footer: domain + date + icon */}
              <div className="flex items-center justify-between gap-2 border-t border-border-hairline pt-3">
                <span className="font-body text-xs text-on-surface-variant/60">{item.domain}</span>
                <div className="flex items-center gap-1.5">
                  {item.dateLabel ? (
                    <time className="font-body text-xs text-on-surface-variant/60">
                      {item.dateLabel}
                    </time>
                  ) : null}
                  <ExternalLinkIcon
                    className="size-3.5 text-on-surface-variant/50 transition-colors group-hover:text-link"
                    aria-hidden
                  />
                </div>
              </div>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
