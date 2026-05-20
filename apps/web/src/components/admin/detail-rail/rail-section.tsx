import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type RailSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

/** Labeled block inside a detail page right rail. */
export function RailSection({ title, children, className }: RailSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
