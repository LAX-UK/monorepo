import { ArtAuthLink } from "@/components/art-auth-link";
import { isArtAuthHref } from "@/lib/is-art-auth-href";
import { MarketingStatusAction } from "@auction/marketing-ui";
import { EmptyState } from "@auction/ui/lax/empty-state";
import {
  type StatusIllustration,
  resolveStatusIllustration,
} from "@auction/ui/lax/status-illustration";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtStatusStateVariant = "empty" | "error";
/** A drawing from the LAX illustration set; `gallery` is the empty frame. */
export type ArtStatusStateIcon = StatusIllustration;

type ArtStatusStateProps = {
  variant: ArtStatusStateVariant;
  icon?: ArtStatusStateIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  /**
   * The title's element. A page-layout state is the page's h1 unless this says otherwise: pass
   * h2 when the page already has its h1 (for-artists/apply). Elsewhere the title is a quiet
   * paragraph unless asked.
   */
  titleAs?: "h1" | "h2" | "p";
  /** `page` for full-route states, `open` (default) for grids and sections, `compact` for short lists. */
  layout?: "open" | "page" | "compact";
  /** Errors are announced politely, empties not at all, unless this says otherwise. */
  announcement?: "none" | "polite" | "assertive";
  className?: string;
};

export function ArtStatusState({
  variant,
  icon,
  title,
  description,
  actions,
  titleAs,
  layout = "open",
  announcement,
  className,
}: ArtStatusStateProps) {
  const isPage = layout === "page";
  const headingLevel = titleAs ?? (isPage ? undefined : "p");
  const live = announcement ?? (variant === "error" ? "polite" : "none");
  const role = live === "none" ? undefined : LIVE_ROLES[live];
  // The kit's error variant always announces itself assertively; lax.art errors are polite, so
  // an error is drawn askew and the wrapper owns the live region.
  const state = (
    <EmptyState
      layout={isPage ? "page" : "inline"}
      size={layout === "compact" ? "compact" : "default"}
      illustration={variant === "error" ? "askew" : resolveStatusIllustration(icon ?? "gallery")}
      title={title}
      description={description}
      actions={actions}
      {...(headingLevel ? { headingLevel } : {})}
      {...(className ? { className } : {})}
    />
  );
  return role ? <div role={role}>{state}</div> : state;
}

const LIVE_ROLES = { polite: "status", assertive: "alert" } as const;

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
  if (href.startsWith("mailto:")) {
    return (
      <EmailOff>
        <MarketingStatusAction priority={priority} asChild>
          <a href={href} className="art-focus-ring">
            {children}
          </a>
        </MarketingStatusAction>
      </EmailOff>
    );
  }
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
