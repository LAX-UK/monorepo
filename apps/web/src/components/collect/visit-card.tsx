"use client";

import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import type { CollectFailure } from "@/lib/collect/collect-errors";
import type { VisitCardVm } from "@/lib/collect/collect-visit.vm";
import { cancelCollectionAction } from "@/lib/collect/collect.actions";
import { Button, ButtonLink, Dialog, Notice, StatusBadge } from "@auction/ui/lax";
import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const STATUS: Record<
  VisitCardVm["status"],
  { label: string; tone: "info" | "success" | "warning" | "neutral" }
> = {
  booked: { label: "Booked", tone: "info" },
  collected: { label: "Collected", tone: "success" },
  partly_collected: { label: "Partly collected", tone: "warning" },
  not_collected: { label: COLLECT_COPY.badge.notCollected, tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/**
 * One visit: the day, the lots, who collects and what they bring, and what can still be done. A
 * visit to come offers Add to calendar, Change and Cancel until the cut-off; after it the page says
 * who to write to. Past visits say what happened and offer a new time when lots stayed behind.
 */
export function VisitCard({
  visit,
  version,
  readOnly,
  headingLevel = "h2",
}: {
  visit: VisitCardVm;
  version: number;
  /** Someone viewing the account sees the visit but cannot change it. */
  readOnly: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<CollectFailure | null>(null);
  const status = STATUS[visit.status];
  const canAct = !readOnly;

  function cancel() {
    setFailure(null);
    startTransition(async () => {
      const result = await cancelCollectionAction({ bookingId: visit.id, version });
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setConfirming(false);
        setFailure(result.failure);
        if (result.failure.kind === "changed") router.refresh();
      }
    });
  }

  return (
    <article
      aria-labelledby={`visit-${visit.id}-title`}
      className="rounded-lax-card border border-lax-line bg-lax-surface p-5 md:p-6"
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex w-14 shrink-0 flex-col items-center rounded-lax-control border border-lax-line bg-lax-sunken py-2"
        >
          <span className="text-lax-12 text-lax-muted">{visit.tile.weekday}</span>
          <span className="font-lax-display text-lax-20 font-semibold leading-6 text-lax-fg">
            {visit.tile.day}
          </span>
          <span className="text-lax-12 text-lax-muted">{visit.tile.month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Heading
              id={`visit-${visit.id}-title`}
              className="font-lax-display text-lax-18 font-semibold text-lax-fg"
            >
              {visit.when}
            </Heading>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="mt-1 text-lax-13 text-lax-muted">
            {visit.where} · Reference {visit.reference}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-lax-line-subtle">
        {visit.lots.map((lot) => (
          <li key={lot.lotId} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
            <span className="min-w-0 text-lax-14 text-lax-fg">
              {lot.lotNumber !== null ? `Lot ${lot.lotNumber} · ` : ""}
              {lot.title}
            </span>
            {lot.note ? (
              <span className="shrink-0 text-lax-13 text-lax-muted">{lot.note}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid gap-1 text-lax-14">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-lax-muted">Collector</dt>
          <dd className="text-lax-fg">
            {visit.collector.name}
            {visit.collector.detail ? ` · ${visit.collector.detail}` : ""}
          </dd>
        </div>
      </dl>
      {visit.live ? <p className="mt-2 text-lax-13 text-lax-muted">{visit.idRule}</p> : null}
      {visit.bookedByAnother ? (
        <p className="mt-2 text-lax-13 text-lax-muted">
          Booked by another member of your organisation.
        </p>
      ) : null}

      {visit.outcome ? (
        <Notice tone={visit.outcome.tone} title={visit.outcome.title} className="mt-4">
          {visit.outcome.body}
        </Notice>
      ) : null}

      {failure ? <Notice tone="danger" alert title={failure.message} className="mt-4" /> : null}

      {visit.live ? (
        <div className="mt-4 flex flex-col gap-3">
          {visit.deadline ? <p className="text-lax-13 text-lax-muted">{visit.deadline}</p> : null}
          {visit.afterCutoff ? (
            <p className="text-lax-13 text-lax-muted">{visit.afterCutoff}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={visit.calendarHref}
              variant="secondary"
              icon={<CalendarPlus aria-hidden />}
              download
            >
              {COLLECT_COPY.booked.addToCalendar}
            </ButtonLink>
            {canAct && visit.can.change ? (
              <ButtonLink href={visit.changeHref} Link={Link} variant="secondary">
                {COLLECT_COPY.booked.change}
              </ButtonLink>
            ) : null}
            {canAct && visit.can.cancel ? (
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                {COLLECT_COPY.booked.cancel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {visit.rebook && canAct ? (
        <div className="mt-4">
          <ButtonLink href={visit.rebook.href} Link={Link} variant="secondary">
            {visit.rebook.label}
          </ButtonLink>
        </div>
      ) : null}

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
        title={COLLECT_COPY.cancel.title(visit.when.split(",")[0] ?? visit.when)}
        description={COLLECT_COPY.cancel.body(null)}
        footerLayout="stacked"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              {COLLECT_COPY.cancel.keep}
            </Button>
            <Button variant="danger" onClick={cancel} loading={pending}>
              {pending ? COLLECT_COPY.cancel.confirming : COLLECT_COPY.cancel.confirm}
            </Button>
          </>
        }
      />
    </article>
  );
}
