import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import type { ReactNode } from "react";

export type MarketingEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Dashed marketing panel (search/sales tabs). */
  variant?: "default" | "marketing" | "panel";
  className?: string;
  role?: string;
};

const panelShell =
  "mx-auto max-w-screen-2xl rounded-xl border border-border-hairline bg-surface-container-low/50 px-8 py-12 text-center ring-1 ring-outline-variant/10";

const marketingShell =
  "border border-dashed border-outline-variant/30 bg-white py-12 dark:border-outline-variant/30 dark:bg-surface-container-low/40";

export function MarketingEmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
  role,
}: MarketingEmptyStateProps) {
  const descriptionIsString = typeof description === "string" || description === undefined;

  if (variant === "panel" || (description && !descriptionIsString)) {
    return (
      <div
        className={cn(variant === "panel" ? panelShell : marketingShell, className)}
        {...(role ? { role } : {})}
      >
        {icon ? <div className="mb-4 flex justify-center text-primary">{icon}</div> : null}
        <h3 className="font-headline text-lg text-on-surface md:text-xl">{title}</h3>
        {description ? (
          <div className="mt-2 font-body text-sm text-on-surface-variant">{description}</div>
        ) : null}
        {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
      </div>
    );
  }

  const descriptionText = typeof description === "string" ? description : undefined;

  return (
    <div {...(role ? { role } : {})}>
      <EmptyState
        variant={variant === "marketing" ? "marketing" : "default"}
        icon={icon}
        title={title}
        {...(descriptionText ? { description: descriptionText } : {})}
        action={action}
        className={cn(variant === "marketing" && marketingShell, className)}
      />
    </div>
  );
}
