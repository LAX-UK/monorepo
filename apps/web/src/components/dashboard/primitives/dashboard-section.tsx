import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";

export type DashboardSectionVariant = "plain" | "card" | "inset";

export type DashboardSectionProps = {
  id?: string;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: DashboardSectionVariant;
};

const variantMap = {
  plain: "section" as const,
  card: "card" as const,
  inset: "inset" as const,
};

/** Semantic section with consistent dashboard spacing and typography (light/dark safe). */
export function DashboardSection({
  id,
  title,
  description,
  action,
  children,
  className,
  variant = "plain",
}: DashboardSectionProps) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-heading` : undefined}>
      <Surface variant={variantMap[variant]} className={cn("space-y-4", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2
              id={id ? `${id}-heading` : undefined}
              className="font-headline text-lg tracking-tight text-on-surface sm:text-xl"
            >
              {title}
            </h2>
            {description ? (
              <p className="max-w-prose font-body text-sm text-on-surface-variant">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className="text-on-surface">{children}</div>
      </Surface>
    </section>
  );
}
