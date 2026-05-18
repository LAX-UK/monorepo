import { cn } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import type { ComponentProps } from "react";

type EmptyProps = Omit<ComponentProps<typeof EmptyState>, "variant">;

export type DashboardEmptyStateVariant = "quiet" | "hero";

export type DashboardEmptyStateProps = EmptyProps & {
  variant?: DashboardEmptyStateVariant;
};

/** Dashboard-scoped empty state — `quiet` (inline lists) or `hero` (whole-page). */
export function DashboardEmptyState({
  className,
  variant = "quiet",
  icon,
  title,
  description,
  action,
  illustration,
}: DashboardEmptyStateProps) {
  if (variant === "hero") {
    return (
      <section
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl bg-surface-container-low/20 px-6 py-12 text-center sm:px-10 sm:py-16",
          className,
        )}
        aria-label={typeof title === "string" ? title : undefined}
      >
        {icon ? (
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mb-6 sm:size-16 [&_svg]:size-6 sm:[&_svg]:size-8">
            {icon}
          </div>
        ) : null}
        <h3 className="font-headline text-2xl font-semibold tracking-tight text-on-surface md:text-3xl">
          {title}
        </h3>
        {description ? (
          <p className="mt-3 max-w-md font-body text-sm text-on-surface-variant">{description}</p>
        ) : null}
        {action ? <div className="mt-8">{action}</div> : null}
      </section>
    );
  }

  const quietProps: EmptyProps = {
    title,
    className: cn(
      "rounded-xl border border-dashed border-border-hairline bg-surface-container-low/30 p-6 sm:p-8",
      className,
    ),
  };
  if (description) quietProps.description = description;
  if (action) quietProps.action = action;
  if (illustration) quietProps.illustration = illustration;
  if (icon) quietProps.icon = icon;
  return <EmptyState {...quietProps} />;
}
