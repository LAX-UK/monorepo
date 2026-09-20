import {
  MarketingStatusAction,
  MarketingStatusState,
  type MarketingStatusStateAnnouncement,
  type MarketingStatusStateLayout,
  type MarketingStatusStateMotif,
} from "@auction/marketing-ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ShopStatusStateVariant = "empty" | "error";
export type ShopStatusStateIcon = "bag" | "search" | "alert";

type ShopStatusStateProps = {
  variant: ShopStatusStateVariant;
  icon?: ShopStatusStateIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  titleAs?: "h1" | "h2" | "p";
  /** Page-level commerce/account empties; inline for catalogue grids and home rails. */
  layout?: MarketingStatusStateLayout;
  /** Overrides default first-paint announcement; use polite/assertive for client-side transitions. */
  announcement?: MarketingStatusStateAnnouncement;
  className?: string;
};

function resolveLayout(
  className?: string,
  layoutProp?: MarketingStatusStateLayout,
): MarketingStatusStateLayout {
  if (layoutProp) {
    return layoutProp;
  }
  if (className?.includes("shop-status-state--banner")) {
    return "banner";
  }
  if (className?.includes("shop-status-state--page")) {
    return "page";
  }
  return "inline";
}

function resolveMotif(
  variant: ShopStatusStateVariant,
  icon: ShopStatusStateIcon | undefined,
): MarketingStatusStateMotif {
  if (variant === "error") {
    return "alert";
  }
  if (icon === "bag" || icon === "search") {
    return icon;
  }
  return "gallery";
}

function resolveAnnouncement(
  variant: ShopStatusStateVariant,
  layout: MarketingStatusStateLayout,
): MarketingStatusStateAnnouncement {
  if (variant === "error" && layout === "banner") {
    return "assertive";
  }
  return "none";
}

export function ShopStatusState({
  variant,
  icon,
  title,
  description,
  actions,
  titleAs = "p",
  layout: layoutProp,
  announcement: announcementProp,
  className,
}: ShopStatusStateProps) {
  const layout = resolveLayout(className, layoutProp);
  const headingLevel = titleAs === "p" ? "p" : titleAs;
  const announcement = announcementProp ?? resolveAnnouncement(variant, layout);

  return (
    <MarketingStatusState
      variant={variant}
      layout={layout}
      motif={resolveMotif(variant, icon)}
      title={title}
      description={description}
      actions={actions}
      titleAs={headingLevel}
      announcement={announcement}
      {...(className ? { className } : {})}
    />
  );
}

type ShopStatusStateLinkProps = {
  href: string;
  children: ReactNode;
  priority?: "primary" | "secondary";
};

export function ShopStatusStateLink({
  href,
  children,
  priority = "secondary",
}: ShopStatusStateLinkProps) {
  return (
    <MarketingStatusAction priority={priority} asChild>
      <Link href={href} className="shop-focus-ring">
        {children}
      </Link>
    </MarketingStatusAction>
  );
}

export { MarketingStatusAction as ShopStatusStateAction };
