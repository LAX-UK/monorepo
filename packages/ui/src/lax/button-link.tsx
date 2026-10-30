"use client";

import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { buttonVariants } from "./button-variants.js";
import { Button } from "./button.js";

export type ButtonLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  VariantProps<typeof buttonVariants> & {
    href: string;
    /**
     * The app's link component (e.g. `next/link`) for client-side navigation; a plain anchor when
     * left out (external addresses, sign-in hand-offs).
     */
    Link?: React.ElementType;
    /** Leading icon element, e.g. `<Plus />`. */
    icon?: React.ReactNode;
    prefetch?: boolean;
  };

/**
 * A link that looks like a button, safe to render from a server component. `Button asChild` with
 * a `<Link>` child built on the server can reach the Slot as a deferred reference, and the Slot
 * then renders nothing; here the link element is made on the client, next to the Slot.
 */
export function ButtonLink({
  href,
  Link = "a",
  variant,
  size,
  icon,
  className,
  children,
  prefetch,
  ...anchor
}: ButtonLinkProps) {
  return (
    <Button asChild variant={variant} size={size} icon={icon} className={className}>
      <Link href={href} {...(prefetch === undefined ? {} : { prefetch })} {...anchor}>
        {children}
      </Link>
    </Button>
  );
}
