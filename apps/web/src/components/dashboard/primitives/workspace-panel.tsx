import { cn } from "@auction/ui";
import type { ReactNode } from "react";

/**
 * A titled panel of a record page (a purchase, its payment): a 12px hairline surface with its
 * title as a section heading, so every panel on the page is a labelled region.
 */
export function WorkspacePanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("rounded-lax-card border border-lax-line bg-lax-surface p-5 md:p-6", className)}
    >
      <h2 className="font-lax-display text-lax-18 font-semibold text-lax-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
