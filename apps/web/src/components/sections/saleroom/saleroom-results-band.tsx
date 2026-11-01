import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { ResultsBandVM, ResultsStat } from "@/lib/marketing/saleroom/results-band";
import { cn } from "@auction/ui";
import { Notice, TextLink } from "@auction/ui/lax";
import Link from "next/link";

function Stat({ stat }: { stat: ResultsStat }) {
  return (
    <div className="min-w-0">
      <dt className="font-label text-xs font-medium text-on-surface-variant">{stat.label}</dt>
      <dd className="mt-1">
        <span className="block font-headline text-xl font-semibold text-on-surface">
          {stat.value}
        </span>
        {stat.detail ? (
          <span className="mt-1 block truncate text-sm">
            <TextLink Link={Link} href={stat.detail.href}>
              {stat.detail.text}
            </TextLink>
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * The results of an ended sale, at the top of its page. The figures come from the server, so a
 * half-loaded catalogue never produces a total; until they are final a notice says so instead.
 */
export function SaleroomResultsBand({ band }: { band: ResultsBandVM }) {
  return (
    <section
      aria-label="Sale results"
      className={cn(MARKETING_PAGE_SHELL, "pb-0 pt-[var(--section-spacing-tight)]")}
    >
      {band.state === "finalising" ? (
        <Notice title={band.title}>{band.detail}</Notice>
      ) : (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-7 dark:bg-surface-container-low/40">
          <h2 className="font-headline text-[length:var(--text-title-section)] font-semibold text-on-surface">
            {band.heading}
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {band.stats.map((stat) => (
              <Stat key={stat.label} stat={stat} />
            ))}
          </dl>
          <p className="mt-4 text-sm text-on-surface-variant">{band.footnote}</p>
        </div>
      )}
    </section>
  );
}
