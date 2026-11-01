import { MediaImage } from "@/components/ui/media-image";
import type { ResultsCover, ResultsFigures, ResultsRowVM } from "@/lib/marketing/results-page.vm";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";

const FIGURE_LABEL = "text-lax-12 text-lax-muted";
const FIGURE_VALUE = "text-lax-16 font-semibold text-lax-fg tabular-nums";

/** The sale's top works side by side; a hatched placeholder holds the place when there are none. */
function Covers({ covers, title }: { covers: readonly ResultsCover[]; title: string }) {
  const slots: (ResultsCover | null)[] = [covers[0] ?? null, covers[1] ?? covers[0] ?? null];
  return (
    <div aria-hidden className="flex w-full max-w-60 gap-2 md:w-60">
      {slots.map((cover, index) => (
        <div
          // The same cover can fill both slots for a sale with one image.
          key={`${cover?.url ?? "none"}-${index}`}
          className="relative aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-lax-menu bg-lax-paper"
        >
          <MediaImage
            src={cover?.url ?? null}
            alt={cover?.alt ?? title}
            label="Sale cover"
            className="absolute inset-0 size-full"
            imgClassName="size-full object-cover"
            sizes="120px"
          />
        </div>
      ))}
    </div>
  );
}

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className={FIGURE_LABEL}>{label}</dt>
      <dd className={muted ? "text-lax-16 text-lax-muted" : FIGURE_VALUE}>{value}</dd>
    </div>
  );
}

const FIGURE_GRID = "grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-[9rem_12rem]";

function Figures({ figures }: { figures: ResultsFigures }) {
  if (figures.state === "finalising") {
    return (
      <dl className={FIGURE_GRID}>
        <Figure label="Sold" value="To follow" muted />
        <Figure label="Total with premium" value="To follow" muted />
      </dl>
    );
  }
  return (
    <dl className={FIGURE_GRID}>
      <Figure label="Sold" value={figures.sold} />
      {figures.total ? <Figure label="Total with premium" value={figures.total} /> : null}
    </dl>
  );
}

export function ResultsSaleRow({ row }: { row: ResultsRowVM }) {
  const finalising = row.figures.state === "finalising";
  return (
    <li className="min-w-0 rounded-lax-card border border-lax-line bg-lax-surface p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <Covers covers={row.covers} title={row.title} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 font-lax-display text-lax-20 font-semibold text-balance text-lax-fg">
                <Link
                  href={row.href}
                  className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-lax-focus"
                >
                  {row.title}
                </Link>
              </h2>
              {finalising ? (
                <StatusBadge tone="neutral" shape="dot">
                  Finalising
                </StatusBadge>
              ) : null}
            </div>
            <p className="text-lax-14 text-lax-muted">{row.endedLabel}</p>
          </div>
          <Figures figures={row.figures} />
        </div>
        <ButtonLink
          Link={Link}
          href={row.href}
          variant={finalising ? "secondary" : "primary"}
          className="w-full md:w-auto md:shrink-0"
          aria-label={`${row.actionLabel}: ${row.title}`}
        >
          {row.actionLabel}
        </ButtonLink>
      </div>
    </li>
  );
}
