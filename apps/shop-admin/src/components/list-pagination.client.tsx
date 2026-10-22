"use client";

import { TransitionLink } from "@/components/enquiries/transition-link.client";
import { Button } from "@auction/ui";

/**
 * First page / Next page links for a keyset-paged list. Both are real links that keep the
 * filters in the URL; `navigate` runs a plain click in the caller's transition.
 */
export function ListPagination({
  firstHref,
  nextHref,
  navigate,
}: {
  /** Set when the current page is not the first. */
  firstHref: string | null;
  nextHref: string | null;
  navigate: (href: string) => void;
}) {
  if (!firstHref && !nextHref) return null;
  return (
    <nav aria-label="Pagination" className="flex flex-wrap justify-between gap-2">
      {firstHref ? (
        <Button variant="outline" size="md" asChild>
          <TransitionLink href={firstHref} navigateTo={navigate}>
            First page
          </TransitionLink>
        </Button>
      ) : (
        <span />
      )}
      {nextHref ? (
        <Button variant="outline" size="md" asChild>
          <TransitionLink href={nextHref} navigateTo={navigate}>
            Next page
          </TransitionLink>
        </Button>
      ) : null}
    </nav>
  );
}
