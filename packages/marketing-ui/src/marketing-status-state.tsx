import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { LaxIllustration, type LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { MarketingCircleAlertIcon } from "./marketing-icons.js";

/**
 * `inline` is a panel with a border; `open` is the same content on the page itself, with no box;
 * `page` fills the view; `compact` fits a table or short list; `banner` is a one-line notice.
 */
export type MarketingStatusStateLayout = "inline" | "open" | "page" | "banner" | "compact";
export type MarketingStatusStateVariant = "empty" | "error";
/**
 * A drawing from the LAX illustration set. The older names stay as aliases: `gallery` is the
 * empty frame, `search-remove` the magnifier, `bag` the parcel and `alert` the askew frame.
 */
export type MarketingStatusStateMotif =
  | LaxIllustrationName
  | "search-remove"
  | "bag"
  | "gallery"
  | "alert";
export type MarketingStatusStateAnnouncement = "none" | "polite" | "assertive";

export type MarketingStatusStateProps = {
  variant?: MarketingStatusStateVariant;
  layout?: MarketingStatusStateLayout;
  motif?: MarketingStatusStateMotif | null;
  /** Overrides the drawing (e.g. a contextual product mark). */
  motifSlot?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** A control between the description and the actions, such as a search field (not on banners). */
  control?: ReactNode;
  actions?: ReactNode;
  titleAs?: "h1" | "h2" | "h3" | "p";
  announcement?: MarketingStatusStateAnnouncement;
  className?: string;
} & ComponentPropsWithoutRef<"div">;

export type MarketingStatusMotifProps = {
  motif: MarketingStatusStateMotif;
  size?: "page" | "panel" | "compact";
  className?: string;
};

const MOTIF_ALIASES: Partial<Record<MarketingStatusStateMotif, LaxIllustrationName>> = {
  gallery: "frame",
  "search-remove": "search",
  bag: "parcel",
  alert: "askew",
};

export function resolveStatusIllustration(motif: MarketingStatusStateMotif): LaxIllustrationName {
  return MOTIF_ALIASES[motif] ?? (motif as LaxIllustrationName);
}

export function MarketingStatusMotif({
  motif,
  size = "panel",
  className,
}: MarketingStatusMotifProps) {
  const name = resolveStatusIllustration(motif);
  return (
    <div
      className={cn("marketing-status-state__motif", className)}
      aria-hidden="true"
      data-testid={`marketing-status-motif-${motif}`}
    >
      <LaxIllustration name={name} size={size} className="marketing-status-state__art" />
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
  control,
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
      <MarketingStatusMotif
        motif={variant === "error" && motif === "gallery" ? "alert" : motif}
        size={layout === "page" ? "page" : layout === "compact" ? "compact" : "panel"}
      />
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
      {control ? <div className="marketing-status-state__control">{control}</div> : null}
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
