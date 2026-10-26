import { ShopAuthLink } from "@/components/shop-auth-link";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
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
/** A drawing from the LAX illustration set; `bag` is the parcel, `alert` the askew frame. */
export type ShopStatusStateIcon = MarketingStatusStateMotif;

type ShopStatusStateProps = {
  variant: ShopStatusStateVariant;
  icon?: ShopStatusStateIcon;
  title: string;
  description: string;
  /** A control under the description, such as a search field. */
  control?: ReactNode;
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

/** Errors keep the askew frame unless the state is about access or a missing page. */
const ERROR_MOTIFS = new Set<MarketingStatusStateMotif>(["askew", "lock", "ticket"]);

function resolveMotif(
  variant: ShopStatusStateVariant,
  icon: ShopStatusStateIcon | undefined,
): MarketingStatusStateMotif {
  if (variant === "error") {
    return icon && ERROR_MOTIFS.has(icon) ? icon : "alert";
  }
  return icon ?? "gallery";
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
  control,
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
      control={control}
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
  const linkClass = "shop-focus-ring";
  return (
    <MarketingStatusAction priority={priority} asChild>
      {isShopAuthHref(href) ? (
        <ShopAuthLink href={href} className={linkClass}>
          {children}
        </ShopAuthLink>
      ) : (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      )}
    </MarketingStatusAction>
  );
}

export { MarketingStatusAction as ShopStatusStateAction };
