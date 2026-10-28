import { MediaImage } from "@/components/ui/media-image";
import {
  type ConsignmentJourney,
  journeyCaption,
  journeyProgress,
} from "@/lib/seller/consignment-journey";
import type { ConsignmentRow } from "@/lib/seller/consignments.vm";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

const SEGMENT_TONE = {
  done: "bg-on-surface",
  current: "bg-[var(--color-product-accent,var(--color-on-surface))]",
  upcoming: "bg-outline-variant",
} as const;

/** The six steps as a short segmented bar, with the step named under it. */
function JourneyBar({ journey }: { journey: ConsignmentJourney }) {
  return (
    <div className="mt-2.5">
      <ol aria-hidden className="flex w-full max-w-72 gap-1">
        {journeyProgress(journey).map((step) => (
          <li
            key={step.id}
            className={cn("h-1 flex-1 rounded-full", SEGMENT_TONE[step.progress])}
          />
        ))}
      </ol>
      <p className="mt-1.5 font-body text-xs text-on-surface-variant">{journeyCaption(journey)}</p>
    </div>
  );
}

/**
 * The consignments, one row each whether still a submission or already a lot: the work, where it
 * is on its way to sale, and its status. The whole row opens it.
 */
export function ConsignmentsList({ rows }: { rows: readonly ConsignmentRow[] }) {
  return (
    <ul className="divide-y divide-outline-variant/50 overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest">
      {rows.map((row) => (
        <li
          key={row.key}
          className="relative flex items-center gap-4 px-4 py-4 motion-safe:transition-colors hover:bg-surface-container-low has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring md:px-5"
        >
          <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-container-high md:size-18">
            <MediaImage src={row.image} alt="" label="Photo to follow" sizes="72px" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-body text-xs text-on-surface-variant">{row.context}</p>
            <h3 className="mt-0.5 truncate font-headline text-base font-semibold text-on-surface">
              <Link
                href={row.href}
                className="after:absolute after:inset-0 focus-visible:outline-none"
              >
                {row.title}
              </Link>
            </h3>
            {row.journey ? <JourneyBar journey={row.journey} /> : null}
            {/* On a phone the status sits under the work, so the title keeps its width. */}
            <DotStatusPill
              label={row.statusLabel}
              tone={row.statusTone}
              className="mt-2.5 sm:hidden"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 max-sm:hidden">
            <DotStatusPill label={row.statusLabel} tone={row.statusTone} />
            <ChevronRight aria-hidden className="size-4 text-on-surface-variant" />
          </div>
        </li>
      ))}
    </ul>
  );
}
