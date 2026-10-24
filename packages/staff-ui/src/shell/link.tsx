import type * as React from "react";

/**
 * The kit never imports a router. Apps pass their own link (e.g. `next/link`) so navigation stays
 * client-side, and tests pass a plain anchor.
 */
export type StaffLinkProps = {
  href: string;
  className?: string;
  children?: React.ReactNode;
  "aria-current"?: "page";
  "aria-label"?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
};

export type StaffLinkComponent = React.ComponentType<StaffLinkProps>;

export function PlainLink({ prefetch: _prefetch, children, ...props }: StaffLinkProps) {
  return <a {...props}>{children}</a>;
}
