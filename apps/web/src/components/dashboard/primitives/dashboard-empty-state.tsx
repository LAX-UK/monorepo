import {
  EmptyStateIllustration,
  type EmptyStateIllustrationKey,
  resolveEmptyStateIllustration,
} from "@/components/illustrations/empty-state-illustrations";
import { CONTEXT_DEFAULT_ILLUSTRATION, type EmptyStateContext } from "@/lib/ui/empty-state-copy";
import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import { pageTitleClass } from "@auction/ui/lax";
import { type ComponentProps, type ReactNode, useId } from "react";

type EmptyProps = Omit<ComponentProps<typeof EmptyState>, "variant">;

export type DashboardEmptyStateVariant = "quiet" | "hero";

export type DashboardEmptyStateProps = Omit<EmptyProps, "title" | "illustration"> & {
  variant?: DashboardEmptyStateVariant;
  title: ReactNode;
  headingLevel?: "h2" | "h3";
  context?: EmptyStateContext;
  illustration?: EmptyStateIllustrationKey;
};

/** Every state carries a drawing: the caller's, the context's, or the empty frame. */
function resolveIllustrationKey(
  illustration: EmptyStateIllustrationKey | undefined,
  context: EmptyStateContext | undefined,
  hasIcon: boolean,
): EmptyStateIllustrationKey | null {
  if (illustration) return illustration;
  if (context) return CONTEXT_DEFAULT_ILLUSTRATION[context] ?? "frame";
  return hasIcon ? null : "frame";
}

/** Dashboard-scoped empty state — `quiet` (inline lists) or `hero` (whole-page). */
export function DashboardEmptyState({
  className,
  variant = "quiet",
  icon,
  title,
  description,
  action,
  illustration: illustrationKey,
  headingLevel = "h2",
  context,
}: DashboardEmptyStateProps) {
  const headingId = useId();
  const Heading = headingLevel;
  const resolvedKey = resolveIllustrationKey(illustrationKey, context, Boolean(icon));

  if (variant === "hero") {
    return (
      <section
        className={cn(
          "flex flex-col items-center justify-center px-6 py-12 text-center sm:px-10 sm:py-16",
          className,
        )}
        aria-labelledby={headingId}
      >
        {resolvedKey ? (
          <EmptyStateIllustration name={resolvedKey} size="page" className="mb-8" />
        ) : null}
        {icon && !resolvedKey ? (
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mb-6 sm:size-16 [&_svg]:size-6 sm:[&_svg]:size-8">
            {icon}
          </div>
        ) : null}
        <Heading id={headingId} className={pageTitleClass}>
          {title}
        </Heading>
        {description ? (
          <p className="mt-3 max-w-md font-[family-name:var(--font-outfit,var(--font-body))] text-sm text-on-surface-variant md:text-base">
            {description}
          </p>
        ) : null}
        {action ? (
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
            {action}
          </div>
        ) : null}
      </section>
    );
  }

  const quietProps: EmptyProps = {
    title,
    headingLevel,
    headingId,
    className: cn(
      "rounded-xl border border-dashed border-border-hairline bg-surface-container-low/30 p-6 sm:p-8",
      className,
    ),
  };
  if (description) quietProps.description = description;
  if (action) quietProps.action = action;
  if (resolvedKey) quietProps.illustration = resolveEmptyStateIllustration(resolvedKey);
  else if (icon) quietProps.icon = icon;

  return (
    <section aria-labelledby={headingId}>
      <EmptyState {...quietProps} />
    </section>
  );
}
