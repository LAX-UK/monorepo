import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";
import { BodyText } from "@auction/ui";
import Link from "next/link";

type Props = {
  auction: Lot;
};

export function ArtworkMarketingBlocks({ auction }: Props) {
  const m = auction.marketingDetails;
  const est = m.estimate;
  const cr = m.conditionReport;
  const prov = m.provenance ?? [];

  if (!est && !cr && prov.length === 0) return null;

  return (
    <div className="mb-12 space-y-6">
      {est ? (
        <section
          aria-labelledby="estimate-heading"
          className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-6 dark:bg-surface-container-low/20"
        >
          <h2
            id="estimate-heading"
            className="mb-2 font-label text-xs font-bold uppercase tracking-widest text-primary"
          >
            Pre-sale estimate
          </h2>
          <p className="font-headline text-2xl text-on-surface">
            {formatMoney(est.low)} – {formatMoney(est.high)}{" "}
            <span className="text-base font-normal text-on-surface-variant">{est.currency}</span>
          </p>
        </section>
      ) : null}

      {cr?.summary || cr?.details || cr?.downloadUrl ? (
        <details className="group rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-6 open:ring-1 open:ring-primary/20 dark:bg-surface-container-low/20">
          <summary className="cursor-pointer font-label text-xs font-bold uppercase tracking-widest text-on-surface marker:text-primary">
            Condition report
          </summary>
          <div className="mt-4 space-y-3">
            {cr.summary ? (
              <BodyText className="text-on-surface-variant">{cr.summary}</BodyText>
            ) : null}
            {cr.details ? (
              <BodyText className="text-sm text-on-surface-variant">{cr.details}</BodyText>
            ) : null}
            {cr.downloadUrl ? (
              <Link
                href={cr.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
              >
                Download full report<span className="sr-only"> (opens in new tab)</span>
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}

      {prov.length > 0 ? (
        <details className="rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-6 dark:bg-surface-container-low/20">
          <summary className="cursor-pointer font-label text-xs font-bold uppercase tracking-widest text-on-surface marker:text-primary">
            Provenance
          </summary>
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
    </div>
  );
}
