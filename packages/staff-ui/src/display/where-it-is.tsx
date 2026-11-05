import { type LinkComponent, Skeleton, StatusBadge, type StatusBadgeShape } from "@auction/ui/lax";
import * as React from "react";
import { type KeyValueItem, KeyValueList } from "./key-value-list.js";
import { Section } from "./states.js";
import { TextLink } from "./text-link.js";
import { Timeline, type TimelineEvent } from "./timeline.js";

/**
 * How a place is drawn. The words and the artwork rules live in `@auction/artwork-register-contracts`
 * (`WHERE_IT_IS_CHIPS`); the kit only draws what it is given, so a product passes the chip as it is.
 * A hollow marker means buyers cannot see it yet, a filled one that they can, a check that it is sold.
 */
export type WhereItIsChipSpec = {
  label: string;
  tone: "neutral" | "info" | "success" | "warning";
  marker: "hollow" | "filled" | "check";
};

const SHAPE_FOR_MARKER: Record<WhereItIsChipSpec["marker"], StatusBadgeShape> = {
  hollow: "ring",
  filled: "dot",
  check: "check",
};

/** The place as a status badge: tone, marker and words together, never colour alone. */
export function WhereItIsChip({ chip }: { chip: WhereItIsChipSpec }) {
  return (
    <StatusBadge tone={chip.tone} shape={SHAPE_FOR_MARKER[chip.marker]}>
      {chip.label}
    </StatusBadge>
  );
}

export type WhereItIsSectionProps = {
  chip: WhereItIsChipSpec;
  /** The place in a few words, set in semibold: "Live on lax.art". */
  lead: string;
  /** What follows the lead on the same line, with its own punctuation: " since Mon 2 Nov". */
  trail?: string;
  /** One muted sentence under the line: what can happen next, or why. */
  note?: string;
  /** The moves open to this person, as buttons. Leave out for a view-only person. */
  actions?: React.ReactNode;
  /** Facts about the place: "Original or print", "Zoho status". */
  facts?: readonly KeyValueItem[];
  /** The last few moves, newest first, with a link to the full history. */
  moves?: {
    events: readonly TimelineEvent[];
    historyHref?: string;
    Link?: LinkComponent;
  };
  /** The answer is still being worked out. */
  loading?: boolean;
  title?: string;
  className?: string;
};

const DIVIDER = "border-t border-staff-line-subtle";

/**
 * The same "Where it is" block on the From Zoho record, the lax.art artwork page and the Bid lot
 * page: a titled card with the place as a badge, one line saying where the artwork is, the moves
 * open to the person, then facts and recent moves. It draws the answer it is given.
 */
export function WhereItIsSection({
  chip,
  lead,
  trail,
  note,
  actions,
  facts,
  moves,
  loading = false,
  title = "Where it is",
  className,
}: WhereItIsSectionProps) {
  const id = React.useId();
  if (loading) {
    return (
      <Section id={id} title={title} bodyClassName="p-0" {...(className ? { className } : {})}>
        <output aria-label="Checking where it is" className="flex flex-col gap-2 px-4 pt-3.5 pb-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
        </output>
      </Section>
    );
  }
  return (
    <Section
      id={id}
      title={title}
      action={<WhereItIsChip chip={chip} />}
      bodyClassName="p-0"
      {...(className ? { className } : {})}
    >
      <div className="flex flex-col gap-1 px-4 pt-3.5 pb-1">
        <p className="text-staff-sm text-staff-fg">
          <strong className="font-semibold">{lead}</strong>
          {trail}
        </p>
        {note ? <p className="text-staff-xs text-staff-muted">{note}</p> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 px-4 pt-2.5 pb-3.5">{actions}</div>
      ) : (
        <div aria-hidden className="h-2.5" />
      )}
      {facts && facts.length > 0 ? (
        <div className={`${DIVIDER} px-4 py-3`}>
          <KeyValueList items={facts} />
        </div>
      ) : null}
      {moves && moves.events.length > 0 ? (
        <div className={`${DIVIDER} px-4 pt-3 pb-3.5`}>
          <h3 className="mb-3 text-staff-xs font-medium text-staff-muted">Recent moves</h3>
          <Timeline events={moves.events} label="Recent moves" />
          {moves.historyHref ? (
            <p className="mt-3">
              <TextLink
                href={moves.historyHref}
                {...(moves.Link ? { Link: moves.Link } : {})}
                className="text-staff-sm"
              >
                See full history
              </TextLink>
            </p>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
