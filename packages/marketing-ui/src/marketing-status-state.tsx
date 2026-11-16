import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import type { LaxIllustrationName } from "@auction/ui/components/lax-illustration";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The empty and error states themselves are the shared kit `EmptyState` (`@auction/ui/lax`).
 * What stays here is the action button the products put inside it, the layout and motif names
 * their wrappers accept, and the map from the older motif names to the LAX drawings.
 *
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

const MOTIF_ALIASES: Partial<Record<MarketingStatusStateMotif, LaxIllustrationName>> = {
  gallery: "frame",
  "search-remove": "search",
  bag: "parcel",
  alert: "askew",
};

export function resolveStatusIllustration(motif: MarketingStatusStateMotif): LaxIllustrationName {
  return MOTIF_ALIASES[motif] ?? (motif as LaxIllustrationName);
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
