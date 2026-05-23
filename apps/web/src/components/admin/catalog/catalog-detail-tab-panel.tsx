import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** When false, children render without the bordered surface wrapper. */
  framed?: boolean;
  className?: string;
};

/** Standard tab body wrapper for catalog entity detail routes. */
export function CatalogDetailTabPanel({
  title,
  description,
  children,
  framed = true,
  className,
}: Props) {
  const header =
    title || description ? (
      <div className="space-y-1">
        {title ? (
          <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="font-body text-sm leading-relaxed text-on-surface-variant">{description}</p>
        ) : null}
      </div>
    ) : null;

  if (!framed) {
    return (
      <div className={cn("scroll-mt-24 space-y-6", className)}>
        {header}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("scroll-mt-24 space-y-6", className)}>
      {header}
      <div className="rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
        {children}
      </div>
    </div>
  );
}
