import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingHangLabelProps = {
  /** Quiet line above the title, for example "Lot 4". */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** The figure the label leads with: "Current bid" and "£4,200". */
  price?: { qualifier?: ReactNode; value: ReactNode } | undefined;
  /** Quiet lines under the price, for example the close time or the framed note. */
  notes?: readonly string[] | undefined;
  className?: string;
};

/**
 * A wall label: the small card beside a work in a gallery. The same lines in the same order for
 * every product, so a lot, an edition and an original read alike. Place it in the `label` slot of
 * a hang work; the work's figure carries the hover state, so the title underlines with it.
 */
export function MarketingHangLabel({
  eyebrow,
  title,
  price,
  notes,
  className,
}: MarketingHangLabelProps) {
  return (
    <span className={cn("grid gap-px", className)}>
      {eyebrow ? (
        <span className="font-body text-xs leading-4 text-on-surface-variant">{eyebrow}</span>
      ) : null}
      <span className="line-clamp-2 font-headline text-sm font-medium leading-5 text-on-surface decoration-1 underline-offset-[3px] group-hover:underline">
        {title}
      </span>
      {price ? (
        <span className="font-body text-sm font-semibold leading-5 text-on-surface [font-variant-numeric:tabular-nums]">
          {price.qualifier ? (
            <span className="font-normal text-on-surface-variant">{price.qualifier} </span>
          ) : null}
          {price.value}
        </span>
      ) : null}
      {notes?.map((note) => (
        <span
          key={note}
          className="font-body text-xs leading-4 text-on-surface-variant [font-variant-numeric:tabular-nums]"
        >
          {note}
        </span>
      ))}
    </span>
  );
}
