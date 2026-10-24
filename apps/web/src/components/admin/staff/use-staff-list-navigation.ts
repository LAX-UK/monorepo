"use client";

import type { StaffLinkComponent, StaffLinkProps } from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, createElement, useCallback, useMemo, useTransition } from "react";

/**
 * Navigation for a list whose state lives in the URL. Moves run in a transition, so the table can
 * dim its current rows while the next page loads instead of jumping to a skeleton, and the links
 * stay real links (middle-click and open-in-new-tab keep working).
 */
export function useStaffListNavigation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href, { scroll: false })),
    [router],
  );
  const TransitionLink = useMemo<StaffLinkComponent>(() => {
    function ListLink({ href, onClick, children, ...rest }: StaffLinkProps) {
      return createElement(
        Link,
        {
          href,
          ...rest,
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            onClick?.(event);
            const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
            if (event.defaultPrevented || event.button !== 0 || modified) return;
            event.preventDefault();
            navigate(href);
          },
        },
        children,
      );
    }
    return ListLink;
  }, [navigate]);
  return { pending, navigate, Link: TransitionLink };
}
