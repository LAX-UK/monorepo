import type { SaleAgendaItemVM } from "@/components/sections/sales/sales-view-models";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { Countdown, LiveDot, cn } from "@auction/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type MonthBucket = {
  key: string;
  label: string;
  items: SaleAgendaItemVM[];
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(iso));
}

function groupByMonth(items: readonly SaleAgendaItemVM[]): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>();
  for (const item of items) {
    const key = monthKey(item.startIso);
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      buckets.set(key, { key, label: monthLabel(item.startIso), items: [item] });
    }
  }
  return [...buckets.values()];
}

/** Agenda-by-month view for the sales calendar: sticky month headers with date-chipped rows. */
export function SalesCalendarMonthGrid({ items }: { items: readonly SaleAgendaItemVM[] }) {
  const months = groupByMonth(items);

  return (
    <div className="flex flex-col gap-10">
      {months.map((month) => (
        <section key={month.key} aria-label={month.label}>
          <h3 className="sticky top-[var(--header-height)] z-[1] -mx-2 mb-3 bg-page-bg/90 px-2 py-2 font-headline text-lg font-semibold text-on-surface backdrop-blur-sm dark:bg-background/90">
            {month.label}
          </h3>
          <ul className="flex flex-col divide-y divide-border-hairline border-y border-border-hairline">
            {month.items.map((item) => {
              const isLive = item.status === "active";
              const isEnded = item.status === "ended";
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-stretch gap-4 py-4 transition-colors hover:bg-surface-container-low/50 sm:gap-6",
                      FOCUS_RING,
                    )}
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2 sm:w-16">
                      <span className="font-headline text-2xl font-semibold leading-none text-on-surface tabular-nums">
                        {item.dayLabel}
                      </span>
                      <span className="mt-1 font-label text-[0.6rem] font-bold uppercase tracking-wider text-on-surface-variant">
                        {item.weekdayLabel}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                      <div className="flex items-center gap-2">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 font-label text-[0.6rem] font-bold uppercase tracking-wider text-cta-bg">
                            <LiveDot className="live-dot-pulse h-1.5 w-1.5" />
                            Live
                          </span>
                        ) : null}
                        <span className="truncate font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant">
                          {item.auctionTypeLabel}
                        </span>
                      </div>
                      <p className="truncate font-headline text-base font-semibold text-on-surface group-hover:text-primary">
                        {item.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-body text-xs text-on-surface-variant">
                        <span className="tabular-nums">{item.timeLabel}</span>
                        <span aria-hidden>·</span>
                        <span>{item.itemsLabel}</span>
                        {item.locationLabel ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{item.locationLabel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 self-center">
                      {isLive && item.countdownEndIso ? (
                        <span className="hidden font-label text-xs font-semibold tabular-nums text-cta-bg sm:inline">
                          <Countdown end={new Date(item.countdownEndIso)} announce={false} />
                        </span>
                      ) : isEnded ? (
                        <span className="hidden font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant sm:inline">
                          Results
                        </span>
                      ) : null}
                      <ChevronRight
                        className="size-4 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
