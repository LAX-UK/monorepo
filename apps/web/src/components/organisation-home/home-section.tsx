import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { HomeSectionHeading } from "./home-section-heading";
import { HomeSeeAllLink } from "./home-see-all-link";

type Props = {
  /** The heading's id; the section and its list are labelled by it. */
  id: string;
  title: string;
  /** "See all" to the page behind the section, when there is one. */
  seeAllHref?: string | null;
  children: ReactNode;
};

/**
 * One Home section: its heading (and "See all") in the page column, then its content. Sections
 * share this frame so Home reads as one calm column, with one card per section at most.
 */
export function HomeSection({ id, title, seeAllHref = null, children }: Props) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <HomeSectionHeading id={id}>{title}</HomeSectionHeading>
        {seeAllHref ? <HomeSeeAllLink href={seeAllHref} /> : null}
      </div>
      {children}
    </section>
  );
}

/** The card a Home section's rows sit on: one hairline, the card radius, no shadow. */
export const HOME_PANEL_CLASS =
  "rounded-2xl border border-border-hairline bg-surface-container-lowest";

/** A Home section's card. */
export function HomePanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(HOME_PANEL_CLASS, className)}>{children}</div>;
}
