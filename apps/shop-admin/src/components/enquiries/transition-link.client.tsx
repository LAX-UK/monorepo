"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

type TransitionLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: string;
  /** Runs a plain left-click navigation inside the caller's transition, so it can show a pending state. */
  navigateTo: (href: string) => void;
};

/**
 * A real link, so middle-click, copy-address and open-in-new-tab keep working; only an
 * ordinary click is routed through `navigateTo`.
 */
export function TransitionLink({ href, navigateTo, children, ...rest }: TransitionLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified) return;
    event.preventDefault();
    navigateTo(href);
  };
  return (
    <Link href={href} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
