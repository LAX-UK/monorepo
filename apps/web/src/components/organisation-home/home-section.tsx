import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  /** The heading's id; the section and its list are labelled by it. */
  id: string;
  title: string;
  /** A link at the end of the heading row ("See all", "All sales"), or any small control. */
  link?: { href: string; label: string } | null;
  end?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** The heading every Home section uses (18/24), so the sections read as one page. */
export function HomeSectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="font-lax-display text-lax-18 font-semibold text-lax-fg">
      {children}
    </h2>
  );
}

/** A quiet underlined link in a heading row. */
export function HomeTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lax-badge text-lax-14 font-medium whitespace-nowrap text-lax-fg underline decoration-lax-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lax-focus"
    >
      {children}
    </Link>
  );
}

/**
 * One Home section: its heading (and a link at the end of the row), then its content. Sections
 * share this frame so Home reads as one page, with one card per section at most.
 */
export function HomeSection({ id, title, link = null, end, className, children }: Props) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0", className)}>
      <div className="mb-3 flex min-h-6 items-baseline gap-2">
        <HomeSectionHeading id={id}>{title}</HomeSectionHeading>
        <span className="ml-auto flex shrink-0 items-baseline">
          {end}
          {link ? <HomeTextLink href={link.href}>{link.label}</HomeTextLink> : null}
        </span>
      </div>
      {children}
    </section>
  );
}

/** The card a Home section's rows sit on: one hairline, the card radius, no shadow. */
export const HOME_PANEL_CLASS = "rounded-lax-card border border-lax-line bg-lax-surface";

/** A Home section's card. */
export function HomePanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(HOME_PANEL_CLASS, className)}>{children}</div>;
}

/** A link that fills a cell or row of a Home card: the hover layer, and a ring drawn inside. */
export const HOME_CELL_LINK_CLASS =
  "transition-colors duration-150 hover:bg-lax-hover active:bg-lax-pressed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lax-focus";
