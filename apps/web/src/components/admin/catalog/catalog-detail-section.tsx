import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Section heading + optional helper copy for catalog detail pages. */
export function CatalogDetailSection({ title, description, children, className }: Props) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
          {title}
        </h2>
        {description ? (
          <p className="font-body text-sm leading-relaxed text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
