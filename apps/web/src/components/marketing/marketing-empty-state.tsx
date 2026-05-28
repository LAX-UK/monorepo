import {
  EmptyStateIllustration,
  type EmptyStateIllustrationKey,
} from "@/components/illustrations/empty-state-illustrations";
import { CONTEXT_DEFAULT_ILLUSTRATION, type EmptyStateContext } from "@/lib/ui/empty-state-copy";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import type { ReactNode } from "react";

/**
 * Marketing catalogue empty-state recipe:
 * - Filtered miss: title + "Clear filters" button + optional browse link (`context="filtered"`)
 * - Unfiltered empty: title + description only (`context="noResults"`)
 * - Fetch error: alert panel + retry/home CTAs (`context="error"`, `role="alert"`)
 */
export type MarketingEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Dashed marketing panel (search/sales tabs). */
  variant?: "default" | "marketing" | "panel";
  className?: string;
  role?: string;
  context?: EmptyStateContext;
  illustration?: EmptyStateIllustrationKey;
};

const panelShell =
  "mx-auto max-w-[var(--container-inner,1376px)] rounded-xl border border-border-hairline bg-surface-container-low/50 px-8 py-12 text-center ring-1 ring-outline-variant/10";

const marketingShell =
  "border border-dashed border-outline-variant/30 bg-white py-12 dark:border-outline-variant/30 dark:bg-surface-container-low/40";

function resolveIllustrationKey(
  illustration: EmptyStateIllustrationKey | undefined,
  context: EmptyStateContext | undefined,
): EmptyStateIllustrationKey | null {
  if (illustration) return illustration;
  if (!context) return null;
  if (context === "noResults" || context === "filtered") return null;
  return CONTEXT_DEFAULT_ILLUSTRATION[context];
}

export function MarketingEmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
  role,
  context,
  illustration,
}: MarketingEmptyStateProps) {
  const illustrationKey = resolveIllustrationKey(illustration, context);
  const resolvedIllustration = illustrationKey ? (
    <EmptyStateIllustration name={illustrationKey} />
  ) : undefined;
  const resolvedRole = role ?? (context === "error" ? "alert" : undefined);

  const descriptionIsString = typeof description === "string" || description === undefined;

  if (variant === "panel" || (description && !descriptionIsString)) {
    return (
      <div
        className={cn(variant === "panel" ? panelShell : marketingShell, className)}
        {...(resolvedRole ? { role: resolvedRole } : {})}
      >
        {resolvedIllustration ? (
          <div className="mb-4 flex justify-center">{resolvedIllustration}</div>
        ) : null}
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
    <div {...(resolvedRole ? { role: resolvedRole } : {})}>
      <EmptyState
        variant={variant === "marketing" ? "marketing" : "default"}
        icon={icon}
        illustration={resolvedIllustration}
        title={title}
        {...(descriptionText ? { description: descriptionText } : {})}
        action={action}
        className={cn(variant === "marketing" && marketingShell, className)}
      />
    </div>
  );
}
