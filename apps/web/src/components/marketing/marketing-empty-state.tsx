import {
  type EmptyStateIllustrationKey,
  resolveEmptyStateIllustration,
} from "@/components/illustrations/empty-state-illustrations";
import { CONTEXT_DEFAULT_ILLUSTRATION, type EmptyStateContext } from "@/lib/ui/empty-state-copy";
import { cn } from "@auction/ui";
import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { EmptyState } from "@auction/ui/lax";
import type { ReactNode } from "react";

/**
 * The empty state of Bid's public lists, on the kit EmptyState:
 * - Filtered miss: title + "Clear filters" button + optional browse link (`context="filtered"`)
 * - Unfiltered empty: title + description only (`context="noResults"`)
 * - Fetch error: the askew drawing, announced (`context="error"`)
 */
export type MarketingEmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** `marketing` and `panel` sit in the list's own card; `default` is bare. */
  variant?: "default" | "marketing" | "panel";
  size?: "default" | "compact";
  /** A heading level for the section it sits in. */
  headingLevel?: "h2" | "h3";
  className?: string;
  context?: EmptyStateContext;
  illustration?: EmptyStateIllustrationKey;
};

const SEARCH_CONTEXTS: ReadonlySet<EmptyStateContext | undefined> = new Set([
  "noResults",
  "filtered",
]);

/** The drawing: an explicit one wins, searches show the magnifier, everything else a frame. */
function resolveDrawing(
  illustration: EmptyStateIllustrationKey | undefined,
  context: EmptyStateContext | undefined,
): LaxIllustrationName {
  if (illustration) return resolveEmptyStateIllustration(illustration);
  if (SEARCH_CONTEXTS.has(context)) return "search";
  const fromContext = context ? CONTEXT_DEFAULT_ILLUSTRATION[context] : null;
  return fromContext ? resolveEmptyStateIllustration(fromContext) : "frame";
}

export function MarketingEmptyState({
  title,
  description,
  action,
  variant = "default",
  size = "default",
  headingLevel = "h2",
  className,
  context,
  illustration,
}: MarketingEmptyStateProps) {
  const carded = variant !== "default";
  return (
    <EmptyState
      illustration={resolveDrawing(illustration, context)}
      variant={context === "error" ? "error" : "empty"}
      size={size}
      headingLevel={headingLevel}
      title={title}
      description={description ?? ""}
      {...(action ? { actions: action } : {})}
      className={cn(carded && "rounded-lax-card border border-lax-line bg-lax-surface", className)}
    />
  );
}
