import type * as React from "react";

/**
 * The primitives never import a router. Apps pass their own link (e.g. `next/link`) so navigation stays
 * client-side, and tests pass a plain anchor.
 */
export type LinkProps = {
  href: string;
  className?: string;
  children?: React.ReactNode;
  "aria-current"?: "page";
  "aria-label"?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
};

export type LinkComponent = React.ComponentType<LinkProps>;

export function PlainLink({ prefetch: _prefetch, children, ...props }: LinkProps) {
  return <a {...props}>{children}</a>;
}
