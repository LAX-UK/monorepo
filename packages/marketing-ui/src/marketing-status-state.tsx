import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  MarketingBagIcon,
  MarketingCircleAlertIcon,
  MarketingSearchIcon,
} from "./marketing-icons.js";

export type MarketingStatusStateLayout = "inline" | "page" | "banner";
export type MarketingStatusStateVariant = "empty" | "error";
export type MarketingStatusStateMotif = "search" | "bag" | "gallery" | "alert";
export type MarketingStatusStateAnnouncement = "none" | "polite" | "assertive";

export type MarketingStatusStateProps = {
  variant?: MarketingStatusStateVariant;
  layout?: MarketingStatusStateLayout;
  motif?: MarketingStatusStateMotif | null;
  /** Overrides the built-in hatched plate (e.g. legacy illustrations or contextual icons). */
  motifSlot?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleAs?: "h1" | "h2" | "h3" | "p";
  announcement?: MarketingStatusStateAnnouncement;
  className?: string;
} & ComponentPropsWithoutRef<"div">;

export type MarketingStatusMotifProps = {
  motif: MarketingStatusStateMotif;
  className?: string;
};

const MOTIF_ICONS = {
  search: MarketingSearchIcon,
  bag: MarketingBagIcon,
  alert: MarketingCircleAlertIcon,
} as const;

export function MarketingStatusMotif({ motif, className }: MarketingStatusMotifProps) {
  if (motif === "alert") {
    return (
      <div
        className={cn(
          "marketing-status-state__motif marketing-status-state__motif--alert",
          className,
        )}
        aria-hidden="true"
        data-testid="marketing-status-motif-alert"
      >
        <span className="marketing-status-state__motif-alert-mark">
          <MarketingCircleAlertIcon className="marketing-status-state__motif-alert-icon" />
        </span>
      </div>
    );
  }

  const Icon = motif === "gallery" ? null : MOTIF_ICONS[motif];

  return (
    <div
      className={cn("marketing-status-state__motif", className)}
      aria-hidden="true"
      data-testid={`marketing-status-motif-${motif}`}
    >
      <div className="marketing-status-state__motif-plate">
        <MediaPlaceholder
          label="Gallery"
          tone="auto"
          className="marketing-status-state__motif-hatch"
        />
        {Icon ? (
          <span className="marketing-status-state__motif-glyph">
            <Icon className="marketing-status-state__motif-glyph-icon" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function resolveLiveProps(announcement: MarketingStatusStateAnnouncement) {
  if (announcement === "none") {
    return {};
  }
  if (announcement === "assertive") {
    return { role: "alert" as const, "aria-live": "assertive" as const };
  }
  return { role: "status" as const, "aria-live": "polite" as const };
}

export function MarketingStatusState({
  variant = "empty",
  layout = "inline",
  motif = "gallery",
  motifSlot,
  title,
  description,
  actions,
  titleAs = "h2",
  announcement = "none",
  className,
  ...props
}: MarketingStatusStateProps) {
  const Title = titleAs;
  const liveProps = resolveLiveProps(announcement);
  const rootClass = cn(
    "marketing-status-state",
    `marketing-status-state--${variant}`,
    `marketing-status-state--${layout}`,
    className,
  );

  if (layout === "banner") {
    return (
      <div className={rootClass} {...liveProps} {...props}>
        <div className="marketing-status-state__banner-row">
          <span className="marketing-status-state__banner-icon" aria-hidden="true">
            <MarketingCircleAlertIcon />
          </span>
          <div className="marketing-status-state__banner-copy">
            <Title className="marketing-status-state__title">{title}</Title>
            {description ? (
              <div className="marketing-status-state__description">{description}</div>
            ) : null}
          </div>
          {actions ? (
            <div className="marketing-status-state__actions marketing-status-state__actions--banner">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const resolvedMotif =
    motifSlot ??
    (motif ? (
      <MarketingStatusMotif motif={variant === "error" && motif === "gallery" ? "alert" : motif} />
    ) : null);

  return (
    <div className={rootClass} {...liveProps} {...props}>
      {resolvedMotif ? (
        <div className="marketing-status-state__motif-wrap">{resolvedMotif}</div>
      ) : null}
      <Title className="marketing-status-state__title">{title}</Title>
      {description ? (
        <div className="marketing-status-state__description">{description}</div>
      ) : null}
      {actions ? <div className="marketing-status-state__actions">{actions}</div> : null}
    </div>
  );
}

export type MarketingStatusActionProps = {
  priority?: "primary" | "secondary";
  asChild?: boolean;
  className?: string;
  children: ReactNode;
} & ComponentPropsWithoutRef<"button">;

export function MarketingStatusAction({
  priority = "secondary",
  asChild = false,
  className,
  children,
  ...props
}: MarketingStatusActionProps) {
  const actionClass = cn(
    "marketing-status-state__action",
    priority === "primary"
      ? "marketing-status-state__action--primary"
      : "marketing-status-state__action--secondary",
    FOCUS_RING,
    className,
  );

  if (asChild) {
    return (
      <Slot className={actionClass} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button type="button" className={actionClass} {...props}>
      {children}
    </button>
  );
}
