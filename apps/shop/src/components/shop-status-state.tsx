import { EmptyState, type EmptyStateProps } from "@auction/ui/lax/empty-state";
import {
  type StatusIllustration,
  resolveStatusIllustration,
} from "@auction/ui/lax/status-illustration";
import type { ReactNode } from "react";

export type ShopStatusStateVariant = "empty" | "error";
/** A drawing from the LAX illustration set; `bag` is the parcel, `gallery` the empty frame. */
export type ShopStatusStateIcon = StatusIllustration;
/**
 * `page` for a commerce or account page's own state, `inline` and `open` (the same thing: the
 * shared state draws no box) for grids and rails, `compact` for a short list.
 */
export type ShopStatusStateLayout = "inline" | "open" | "page" | "compact";

type ShopStatusStateProps = {
  variant: ShopStatusStateVariant;
  icon?: ShopStatusStateIcon;
  /** In place of the drawing, e.g. the hatched placeholder of a page that holds works. */
  motifSlot?: ReactNode;
  title: string;
  description: string;
  /** A control under the description, such as a search field. */
  control?: ReactNode;
  actions?: ReactNode;
  /**
   * The title's element. A page-layout state is the page's h1 unless this says otherwise: pass
   * h2 when the page already has its h1 (the basket, checkout and order pages). Elsewhere the
   * title is a quiet paragraph unless asked.
   */
  titleAs?: "h1" | "h2" | "p";
  layout?: ShopStatusStateLayout;
  /** Shop states are silent on first paint; client-side transitions ask for polite or assertive. */
  announcement?: EmptyStateProps["announcement"];
  className?: string;
};

export function ShopStatusState({
  variant,
  icon,
  motifSlot,
  title,
  description,
  control,
  actions,
  titleAs,
  layout = "inline",
  announcement = "none",
  className,
}: ShopStatusStateProps) {
  const isPage = layout === "page";
  const headingLevel = titleAs ?? (isPage ? undefined : "p");

  return (
    <EmptyState
      accent
      variant={variant}
      layout={isPage ? "page" : "inline"}
      size={layout === "compact" ? "compact" : "default"}
      illustration={resolveStatusIllustration(icon ?? "gallery")}
      {...(motifSlot ? { plate: motifSlot } : {})}
      title={title}
      description={description}
      control={control}
      actions={actions}
      {...(headingLevel ? { headingLevel } : {})}
      announcement={announcement}
      {...(className ? { className } : {})}
    />
  );
}

export {
  ShopStatusStateAction,
  ShopStatusStateLink,
} from "@/components/shop-status-state-actions";
