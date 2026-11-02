"use client";

import { MediaImage } from "@/components/ui/media-image";
import { ListEmpty, ListLoadError, ListNoResults } from "@/components/workspace/list-states";
import { RowStep } from "@/components/workspace/row-step";
import { useListQuery } from "@/components/workspace/use-list-query";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import {
  type CollectionWork,
  WHERE_LABEL,
  WORKS_SORTS,
  WORKS_SORT_LABEL,
  type WhereId,
  type WorksListQuery,
  type WorksSort,
  appliedWorksFilters,
  worksInView,
  worksListSearch,
  worksPlaces,
} from "@/lib/seller/collection-works";
import { notify } from "@/lib/ui/notify";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordList,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import {
  ButtonLink,
  Field,
  FilterSheet,
  ListToolbar,
  NativeSelect,
  Notice,
  ShowingCount,
  SortMenu,
  StatusBadge,
} from "@auction/ui/lax";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ANY = "any";

async function copyReference(reference: string) {
  try {
    await navigator.clipboard.writeText(reference);
    notify.success("Reference copied");
  } catch {
    notify.error("We couldn't copy the reference");
  }
}

function WorkRow({
  work,
  showPrice,
  pausedReason,
}: {
  work: CollectionWork;
  showPrice: boolean;
  pausedReason: string | null;
}) {
  const router = useRouter();
  const { reference } = work;
  const menu: InlineActionMenuItem[] = [
    {
      type: "item",
      label: work.kind === "bought" ? "View purchase" : "View lot",
      onSelect: () => router.push(work.href),
    },
    ...(reference
      ? [
          { type: "separator" as const },
          {
            type: "item" as const,
            label: "Copy reference",
            onSelect: () => void copyReference(reference),
          },
        ]
      : []),
  ];
  // Held selling keeps the step in view, disabled with its reason; a work not yet paid has none.
  const offered = pausedReason ? work.consignNote === null : work.canConsign;
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
      meta={[...work.meta, work.consignNote]}
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
        offered ? (
          <RowStep
            label={work.consignLabel}
            accessibleName={`${work.consignLabel}: ${work.title}`}
            href={work.consignHref}
            blockedReason={pausedReason}
          />
        ) : null
      }
      menu={<InlineActionMenu label={`More for ${work.title}`} items={menu} />}
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    if (filterOpen) setDraft(query);
  }, [filterOpen, query]);
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
  const places = worksPlaces(works);
  const filterable = places.length > 1;
  const chips = appliedWorksFilters(query);
  const clearAll = () => setQuery({ ...query, q: "", where: null });
  return (
    <div className="flex flex-col gap-4">
      {pausedReason ? (
        <Notice tone="warning" title={`Selling is paused for ${organisation}.`}>
          Works can't be consigned for now. You can still see every work and where it is.
        </Notice>
      ) : null}
      <ListToolbar
        search={{ value: search, onValueChange: setSearch, placeholder: "Search by title" }}
        {...(filterable
          ? { filter: { count: chips.length, open: filterOpen, onOpenChange: setFilterOpen } }
          : {})}
        sort={
          <SortMenu<WorksSort>
            value={query.sort}
            onValueChange={(sort) => setQuery({ ...query, sort })}
            options={WORKS_SORTS.map((value) => ({ value, label: WORKS_SORT_LABEL[value] }))}
          />
        }
        chips={{
          filters: chips,
          onRemove: () => setQuery({ ...query, where: null }),
          onClearAll: clearAll,
        }}
      />
      {shown.length === 0 ? (
        <ListNoResults query={query.q} onClear={clearAll} />
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
      {filterable ? (
        <FilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          resultCount={worksInView(works, draft).length}
          onApply={() => setQuery(draft)}
          onClear={() => setDraft({ ...draft, where: null })}
        >
          <Field label="Where it is">
            <NativeSelect
              value={draft.where ?? ANY}
              onValueChange={(value) =>
                setDraft({ ...draft, where: value === ANY ? null : (value as WhereId) })
              }
              options={[
                { value: ANY, label: "Anywhere" },
                ...places.map((id) => ({ value: id, label: WHERE_LABEL[id] })),
              ]}
            />
          </Field>
        </FilterSheet>
      ) : null}
    </div>
  );
}
