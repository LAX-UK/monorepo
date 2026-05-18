import {
  aboutArtistBlockContent,
  formatExhibitions,
} from "@/components/sections/artwork/artwork-view-models";
import { lotMarketingSection } from "@/components/sections/artwork/lot-marketing-sections";
import type { PublicUser } from "@/lib/data/contracts";
import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";
import { BodyText } from "@auction/ui";
import Link from "next/link";

type Props = {
  auction: Lot;
  /** Optional; matches lot page “About artist” when the public profile is known. */
  artist?: PublicUser | null;
};

const detailsSummaryClass =
  "cursor-pointer font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface marker:text-primary";

/** Standalone marketing stack (e.g. alternate layouts). Uses the same four section **titles** and
 * **order** as the lot page accordion: Condition report → Provenance → Exhibited → About artist.
 */
export function ArtworkMarketingBlocks({ auction, artist = null }: Props) {
  const m = auction.marketingDetails;
  const est = m.estimate;
  const cr = m.conditionReport;
  const prov = m.provenance ?? [];
  const ex = formatExhibitions(m.exhibitions ?? []);
  const about = aboutArtistBlockContent(auction, artist);

  const hasCondition = Boolean(cr?.summary || cr?.details || cr?.downloadUrl);
  const hasProv = prov.length > 0;
  const hasEx = ex.trim().length > 0;
  const hasAbout = about.trim().length > 0;

  if (!est && !hasCondition && !hasProv && !hasEx && !hasAbout) return null;

  return (
    <div className="mb-12 space-y-6">
      {est ? (
        <section
          aria-labelledby="estimate-heading"
          className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 dark:bg-surface-container-low/20"
        >
          <h2
            id="estimate-heading"
            className="mb-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary"
          >
            Pre-sale estimate
          </h2>
          <p className="font-headline text-2xl text-on-surface">
            {formatMoney(est.low)} – {formatMoney(est.high)}{" "}
            <span className="text-base font-normal text-on-surface-variant">{est.currency}</span>
          </p>
        </section>
      ) : null}

      {hasCondition ? (
        <details className="group rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 open:ring-1 open:ring-primary/20 dark:bg-surface-container-low/20">
          <summary className={detailsSummaryClass}>{lotMarketingSection.condition.title}</summary>
          <div className="mt-4 space-y-3">
            {cr?.summary ? (
              <BodyText className="text-on-surface-variant">{cr.summary}</BodyText>
            ) : null}
            {cr?.details ? (
              <BodyText className="text-sm text-on-surface-variant">{cr.details}</BodyText>
            ) : null}
            {cr?.downloadUrl ? (
              <Link
                href={cr.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
              >
                Download full report<span className="sr-only"> (opens in new tab)</span>
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}

      {hasProv ? (
        <details className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 dark:bg-surface-container-low/20">
          <summary className={detailsSummaryClass}>{lotMarketingSection.provenance.title}</summary>
          <ol className="mt-4 list-decimal space-y-2 pl-5 font-body text-sm text-on-surface-variant">
            {prov.map((p, i) => (
              <li key={`${i}-${p.note.slice(0, 24)}`}>
                {p.period ? (
                  <span className="font-medium text-on-surface">{p.period}: </span>
                ) : null}
                {p.note}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {hasEx ? (
        <details className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 dark:bg-surface-container-low/20">
          <summary className={detailsSummaryClass}>{lotMarketingSection.exhibited.title}</summary>
          <BodyText className="mt-4 whitespace-pre-wrap text-on-surface-variant">{ex}</BodyText>
        </details>
      ) : null}

      {hasAbout ? (
        <details className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6 dark:bg-surface-container-low/20">
          <summary className={detailsSummaryClass}>{lotMarketingSection.artist.title}</summary>
          <BodyText className="mt-4 whitespace-pre-wrap text-on-surface-variant">{about}</BodyText>
        </details>
      ) : null}
    </div>
  );
}
