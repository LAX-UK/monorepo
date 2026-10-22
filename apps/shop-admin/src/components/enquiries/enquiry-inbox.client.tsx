"use client";

import { EnquiryFilters } from "@/components/enquiries/enquiry-filters.client";
import { EnquiryListTable } from "@/components/enquiries/enquiry-list-table.client";
import { TransitionLink } from "@/components/enquiries/transition-link.client";
import {
  ENQUIRY_LIST_PATH,
  type EnquiryInboxQuery,
  enquiryInboxHref,
  enquiryInboxPageHref,
  hasActiveEnquiryFilters,
} from "@/server/domain/enquiry-inbox.vm";
import type { AdminEnquiryListResponse } from "@auction/shop-contracts";
import { Button, EmptyState, TableSkeleton } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * The filterable list. Filter and paging moves run in a transition, which is how the loading
 * state shows without a `loading.tsx` above a route that navigates by query string.
 */
export function EnquiryInbox({
  query,
  page,
}: {
  query: EnquiryInboxQuery;
  page: AdminEnquiryListResponse;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => startTransition(() => router.push(href)),
    [router],
  );
  const filtered = hasActiveEnquiryFilters(query);

  return (
    <section aria-label="Enquiries" aria-busy={pending} className="flex flex-col gap-6">
      {/* Keyed by the search text so "Clear filters" also empties the search box. */}
      <EnquiryFilters key={query.q ?? ""} query={query} counts={page.counts} navigate={navigate} />
      {pending ? (
        <output className="block">
          <span className="sr-only">Loading enquiries</span>
          <TableSkeleton rows={6} columns={6} />
        </output>
      ) : page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            headingLevel="h2"
            title="No enquiries match these filters"
            description="Try a different search, or clear the filters to see everything."
            action={
              <Button type="button" variant="outline" onClick={() => navigate(ENQUIRY_LIST_PATH)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            headingLevel="h2"
            title="No enquiries yet"
            description="Messages sent from lax.art, and questions about artworks, will appear here."
          />
        )
      ) : (
        <EnquiryListTable items={page.items} />
      )}
      {!pending && (query.cursor || page.nextCursor) ? (
        <nav aria-label="Pagination" className="flex flex-wrap justify-between gap-2">
          {query.cursor ? (
            <Button variant="outline" size="md" asChild>
              <TransitionLink href={enquiryInboxHref(query)} navigateTo={navigate}>
                First page
              </TransitionLink>
            </Button>
          ) : (
            <span />
          )}
          {page.nextCursor ? (
            <Button variant="outline" size="md" asChild>
              <TransitionLink
                href={enquiryInboxPageHref(query, page.nextCursor)}
                navigateTo={navigate}
              >
                Next page
              </TransitionLink>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
