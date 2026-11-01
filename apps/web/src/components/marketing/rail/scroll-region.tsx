import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  /** Also the target of the rail's arrows. */
  id: string;
  /** Names the region after its section, so assistive tech announces what scrolls. */
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * The scrolling strip of a rail: a labelled region that takes focus, so the arrow keys scroll it
 * for anyone without a pointer. Put the list inside it.
 */
export function ScrollRegion({ id, label, className, children }: Props) {
  return (
    <section
      id={id}
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
      tabIndex={0}
      className={cn(
        "lax-focus overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </section>
  );
}
