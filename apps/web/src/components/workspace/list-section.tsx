import { formatCount } from "@auction/ui/lax";
import type { ReactNode } from "react";

type Props = {
  /** The heading's id; the section is labelled by it. */
  id: string;
  title: string;
  /** How many records the section lists, in muted digits after the title. */
  count?: number;
  /** One line under the heading saying what the list holds. */
  description?: string;
  children: ReactNode;
};

/**
 * A second list on a list page (telephone bids under My bids): the section heading (18/24, an
 * optional count), one line of description, then the list or its state. Sections sit 40px under
 * the list before them.
 */
export function ListSection({ id, title, count, description, children }: Props) {
  return (
    <section aria-labelledby={id} className="mt-10 min-w-0">
      <div className="mb-3">
        <div className="flex min-h-6 items-baseline gap-2">
          <h2 id={id} className="font-lax-display text-lax-18 font-semibold text-lax-fg">
            {title}
          </h2>
          {count === undefined ? null : (
            <span className="text-lax-14 text-lax-muted tabular-nums">{formatCount(count)}</span>
          )}
        </div>
        {description ? <p className="mt-1 text-lax-14 text-lax-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
