import { ArtAuthLink } from "@/components/art-auth-link";
import { isArtAuthHref } from "@/lib/is-art-auth-href";
import {
  MarketingStatusAction,
  MarketingStatusState,
  type MarketingStatusStateAnnouncement,
  type MarketingStatusStateLayout,
  type MarketingStatusStateMotif,
} from "@auction/marketing-ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtStatusStateVariant = "empty" | "error";
export type ArtStatusStateIcon = "search" | "gallery";

type ArtStatusStateProps = {
  variant: ArtStatusStateVariant;
  icon?: ArtStatusStateIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  titleAs?: "h1" | "h2" | "p";
  /** `page` for full-route empties, `inline` for grids and sections. */
  layout?: MarketingStatusStateLayout;
  announcement?: MarketingStatusStateAnnouncement;
  className?: string;
};

function resolveMotif(
  variant: ArtStatusStateVariant,
  icon: ArtStatusStateIcon | undefined,
): MarketingStatusStateMotif {
  if (variant === "error") return "alert";
  return icon ?? "gallery";
}

export function ArtStatusState({
  variant,
  icon,
  title,
  description,
  actions,
  titleAs = "p",
  layout = "inline",
  announcement,
  className,
}: ArtStatusStateProps) {
  return (
    <MarketingStatusState
      variant={variant}
      layout={layout}
      motif={resolveMotif(variant, icon)}
      title={title}
      description={description}
      actions={actions}
      titleAs={titleAs}
      announcement={announcement ?? (variant === "error" ? "polite" : "none")}
      {...(className ? { className } : {})}
    />
  );
}

type ArtStatusStateLinkProps = {
  href: string;
  children: ReactNode;
  priority?: "primary" | "secondary";
};

export function ArtStatusStateLink({
  href,
  children,
  priority = "secondary",
}: ArtStatusStateLinkProps) {
  return (
    <MarketingStatusAction priority={priority} asChild>
      {isArtAuthHref(href) ? (
        <ArtAuthLink href={href} className="art-focus-ring">
          {children}
        </ArtAuthLink>
      ) : (
        <Link href={href} className="art-focus-ring">
          {children}
        </Link>
      )}
    </MarketingStatusAction>
  );
}
