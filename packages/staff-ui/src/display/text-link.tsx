import type { LinkComponent } from "@auction/ui/lax";
import { ExternalLink } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

/**
 * A link in running text or a facts list, outside a table: underlined so it reads as a link at
 * rest, the underline darkening on hover. Table cells use `CellLink`, which underlines only on
 * hover because the whole row already reads as openable.
 */
export const staffTextLinkClass =
  "staff-focus inline-flex max-w-full items-center gap-1 rounded-staff-xs align-middle font-medium leading-6 text-staff-fg underline decoration-staff-line-strong underline-offset-2 hover:decoration-staff-fg";

/**
 * An in-app link through the app's `Link`, a `mailto:`/`tel:` link, or with `external` a page on
 * another site: that one opens in a new tab, shows the external-link icon and says so to screen
 * readers.
 */
export function TextLink({
  href,
  Link,
  external = false,
  className,
  children,
}: {
  href: string;
  /** The app's router link, for in-app pages. */
  Link?: LinkComponent;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(staffTextLinkClass, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        <span className="truncate">{children}</span>
        <ExternalLink
          aria-hidden
          className="size-3.5 shrink-0 text-staff-muted"
          strokeWidth={1.75}
        />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  if (Link) {
    return (
      <Link href={href} className={classes}>
        <span className="truncate">{children}</span>
      </Link>
    );
  }
  return (
    <a href={href} className={classes}>
      <span className="truncate">{children}</span>
    </a>
  );
}
