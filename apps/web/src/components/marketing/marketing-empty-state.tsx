import {
  EmptyStateIllustration,
  type EmptyStateIllustrationKey,
} from "@/components/illustrations/empty-state-illustrations";
import { CONTEXT_DEFAULT_ILLUSTRATION, type EmptyStateContext } from "@/lib/ui/empty-state-copy";
import {
  MarketingStatusState,
  type MarketingStatusStateAnnouncement,
  type MarketingStatusStateLayout,
  type MarketingStatusStateMotif,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

/**
 * Marketing catalogue empty-state recipe:
 * - Filtered miss: title + "Clear filters" button + optional browse link (`context="filtered"`)
 * - Unfiltered empty: title + description only (`context="noResults"`)
 * - Fetch error: alert panel + retry/home CTAs (`context="error"`, optional `role="alert"`)
 */
export type MarketingEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Dashed marketing panel (search/sales tabs). */
  variant?: "default" | "marketing" | "panel";
  className?: string;
  /** Prefer `announcement`; maps to the shared live-region contract. */
  role?: string;
  announcement?: MarketingStatusStateAnnouncement;
  context?: EmptyStateContext;
  illustration?: EmptyStateIllustrationKey;
};

function resolveIllustrationKey(
  illustration: EmptyStateIllustrationKey | undefined,
  context: EmptyStateContext | undefined,
): EmptyStateIllustrationKey | null {
  if (illustration) return illustration;
  if (!context) return null;
  if (context === "noResults" || context === "filtered") return null;
  return CONTEXT_DEFAULT_ILLUSTRATION[context];
}

function resolveLayout(variant: MarketingEmptyStateProps["variant"]): MarketingStatusStateLayout {
  if (variant === "panel") {
    return "page";
  }
  return "inline";
}

function resolveMotif(context: EmptyStateContext | undefined): MarketingStatusStateMotif | null {
  if (!context) {
    return "gallery";
  }
  if (context === "filtered" || context === "noResults") {
    return "search";
  }
  if (context === "error") {
    return "alert";
  }
  if (context === "firstUse") {
    return "gallery";
  }
  return "gallery";
}

function resolveAnnouncementFromRole(
  role: string | undefined,
): MarketingStatusStateAnnouncement | undefined {
  if (role === "alert") {
    return "assertive";
  }
  if (role === "status") {
    return "polite";
  }
  return undefined;
}

function resolveAnnouncement(
  announcement: MarketingStatusStateAnnouncement | undefined,
  role: string | undefined,
  context: EmptyStateContext | undefined,
): MarketingStatusStateAnnouncement {
  if (announcement) {
    return announcement;
  }
  const fromRole = resolveAnnouncementFromRole(role);
  if (fromRole) {
    return fromRole;
  }
  if (context === "error") {
    return "none";
  }
  return "none";
}

function resolveMotifSlot(
  illustrationKey: EmptyStateIllustrationKey | null,
  icon: ReactNode | undefined,
): ReactNode | undefined {
  if (illustrationKey) {
    return (
      <div className="marketing-status-state__illustration">
        <EmptyStateIllustration name={illustrationKey} />
      </div>
    );
  }
  if (icon) {
    return <div className="marketing-status-state__custom-icon">{icon}</div>;
  }
  return undefined;
}

export function MarketingEmptyState({
  icon,
  title,
  description,
  action,
  variant = "default",
  className,
  role,
  announcement,
  context,
  illustration,
}: MarketingEmptyStateProps) {
  const illustrationKey = resolveIllustrationKey(illustration, context);
  const motifSlot = resolveMotifSlot(illustrationKey, icon);
  const layout = resolveLayout(variant);
  const visualVariant = context === "error" ? "error" : "empty";

  return (
    <MarketingStatusState
      variant={visualVariant}
      layout={layout}
      motif={motifSlot ? null : resolveMotif(context)}
      {...(motifSlot ? { motifSlot } : {})}
      title={title}
      {...(description !== undefined ? { description } : {})}
      {...(action ? { actions: action } : {})}
      titleAs="h3"
      announcement={resolveAnnouncement(announcement, role, context)}
      className={cn(variant === "marketing" && "marketing-status-state--marketing-band", className)}
    />
  );
}
