import { ChevronRight } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils.js";
import { type LinkComponent, PlainLink } from "./link.js";
import { textLinkClass } from "./styles.js";

export type TextLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  /** The app's link component (e.g. `next/link`); a plain anchor when left out. */
  Link?: LinkComponent | React.ElementType;
  /** Adds the 16px chevron that marks a list's "View all". */
  chevron?: boolean;
  prefetch?: boolean;
};

/**
 * The LAX text link: ink and underlined (`textLinkClass`), for running text, "View all" and
 * inline actions. Safe to render from a server component. Anchor attributes pass through.
 */
export function TextLink({
  href,
  Link = PlainLink,
  chevron = false,
  className,
  children,
  prefetch,
  ...anchor
}: TextLinkProps) {
  const Component = Link as React.ElementType;
  return (
    <Component
      href={href}
      className={cn(textLinkClass, className)}
      {...(prefetch === undefined ? {} : { prefetch })}
      {...anchor}
    >
      {children}
      {chevron ? <ChevronRight aria-hidden /> : null}
    </Component>
  );
}
