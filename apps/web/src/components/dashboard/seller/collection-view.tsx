"use client";

import { MediaImage } from "@/components/ui/media-image";
import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { useListQuery } from "@/components/workspace/use-list-query";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import {
  type CollectionWork,
  WORKS_SORTS,
  WORKS_SORT_LABEL,
  type WorksListQuery,
  type WorksSort,
  worksInView,
  worksListSearch,
} from "@/lib/seller/collection-works";
import { RecordList, RecordRow, RecordRowMedia } from "@auction/ui";
import {
  Button,
  ButtonLink,
  ListToolbar,
  Notice,
  ShowingCount,
  SortMenu,
  StatusBadge,
} from "@auction/ui/lax";
import Link from "next/link";

function WorkRow({
  work,
  showPrice,
  pausedReason,
}: {
  work: CollectionWork;
  showPrice: boolean;
  pausedReason: string | null;
}) {
  return (
    <RecordRow
      aria-label={work.where ? `${work.title}, ${work.where.label}` : work.title}
      href={work.href}
      linkAs={Link}
      leading={
        <RecordRowMedia>
          <MediaImage src={work.image} alt="" sizes="48px" />
        </RecordRowMedia>
      }
      title={work.title}
      meta={work.meta}
      {...(showPrice
        ? {
            figures: [
              work.price
                ? { id: "paid", value: work.price, label: "hammer" }
                : { id: "paid", value: "Not bought", label: "hammer", pending: true },
            ],
          }
        : {})}
      aligned
      status={
        work.where ? (
          <StatusBadge tone={work.where.tone} shape={work.where.shape}>
            {work.where.label}
          </StatusBadge>
        ) : null
      }
      action={
        pausedReason ? (
          <Button size="sm" disabledReason={pausedReason}>
            {work.consignLabel}
          </Button>
        ) : work.canConsign ? (
          <ButtonLink
            href={work.consignHref}
            Link={Link}
            size="sm"
            variant="secondary"
            aria-label={`${work.consignLabel}: ${work.title}`}
          >
            {work.consignLabel}
          </ButtonLink>
        ) : null
      }
    />
  );
}

/**
 * The organisation's collection through Bid: works it bought and works that came back unsold,
 * each with where it is and, for a member who sells, "Consign this work".
 */
export function CollectionView({
  works,
  query: initialQuery,
  organisation,
  showPrice,
  canBid,
  pausedReason,
}: {
  /** `null` when the works could not be read. */
  works: CollectionWork[] | null;
  query: WorksListQuery;
  organisation: string;
  /** The member's role sees money. */
  showPrice: boolean;
  canBid: boolean;
  pausedReason: string | null;
}) {
  const { query, setQuery, search, setSearch } = useListQuery(initialQuery, worksListSearch);
  if (!works) return <ListLoadError />;
  if (works.length === 0) {
    return (
      <ListEmpty
        illustration="frame"
        title="No works yet"
        description={`Works ${organisation} buys through LAX Bid appear here.`}
        {...(canBid
          ? {
              actions: (
                <ButtonLink href={calendarSalesHref({ tab: "upcoming" })} Link={Link}>
                  Browse upcoming sales
                </ButtonLink>
              ),
            }
          : {})}
      />
    );
  }
  const shown = worksInView(works, query);
  return (
    <div className="flex flex-col gap-4">
      {pausedReason ? (
        <Notice tone="warning" title={`Selling is paused for ${organisation}.`}>
          Works can't be consigned for now. You can still see every work and where it is.
        </Notice>
      ) : null}
      <ListToolbar
        search={{ value: search, onValueChange: setSearch, placeholder: "Search by title" }}
        sort={
          <SortMenu<WorksSort>
            value={query.sort}
            onValueChange={(sort) => setQuery({ ...query, sort })}
            options={WORKS_SORTS.map((value) => ({ value, label: WORKS_SORT_LABEL[value] }))}
          />
        }
      />
      {shown.length === 0 ? (
        <ListNoResults query={query.q} onClear={() => setQuery({ ...query, q: "" })} />
      ) : (
        <>
          <RecordList aria-label="Works">
            {shown.map((work) => (
              <WorkRow
                key={work.key}
                work={work}
                showPrice={showPrice}
                pausedReason={pausedReason}
              />
            ))}
          </RecordList>
          <ShowingCount shown={shown.length} total={works.length} />
        </>
      )}
      {showPrice ? null : (
        <p className="text-lax-13 text-lax-muted">Prices show to owners, admins and finance.</p>
      )}
    </div>
  );
}
