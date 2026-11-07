import { EMPTY_STATE, SECTION_TITLE } from "@/components/account-ui";
import type { FilterFieldVm } from "@/lib/filter-query";
import { formatDate } from "@/lib/format-date";
import { safeImageUrl } from "@/lib/media-origins";
import {
  type HoldingGroupVm,
  groupHoldingRows,
  holdingsCountLine,
} from "@/server/domain/holding-groups.vm";
import { PRODUCT_LABELS, STATUS_LABELS } from "@/server/domain/portfolio-labels";
import {
  type AllocationCount,
  type HoldingRowVm,
  type HoldingsFilter,
  type HoldingsVm,
  LAX_PORTFOLIO_ITEM_STATUSES,
  LAX_PRODUCT_IDS,
  type holdingsFilterOptions,
} from "@auction/lax-ecosystem";
import { EmptyState } from "@auction/ui/components/empty-state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@auction/ui/components/table";
import { FilterToolbar } from "./filter-toolbar.client";
import { HoldingGroupPhoneCard, HoldingGroupTable } from "./holding-group-views";
import {
  InReviewNote,
  PaidCell,
  WorkTitle,
  amountLabel,
  amountsOf,
  documentsSummary,
} from "./holding-row-parts";
import {
  CurrencyAmounts,
  PortfolioStatusBadge,
  ProductBadge,
  WorkThumbnail,
} from "./portfolio-parts";
import { ProductText } from "./product-name";

type FilterOptions = ReturnType<typeof holdingsFilterOptions>;

type GroupsProps = {
  groups: HoldingGroupVm[];
  imageOrigins: readonly string[];
  /** Groups open at first when a search or filter is narrowing the list. */
  filtered: boolean;
};

/** A work held once: an ordinary row. */
function SingleRow({ row, imageOrigins }: { row: HoldingRowVm; imageOrigins: readonly string[] }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <WorkThumbnail
            src={safeImageUrl(row.item.image, imageOrigins)}
            className="size-12 shrink-0"
          />
          <div className="min-w-0">
            <WorkTitle row={row} />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <ProductBadge product={row.item.product} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(row.item.acquiredAt)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <PaidCell row={row} />
      </TableCell>
      <TableCell>
        <PortfolioStatusBadge status={row.item.status} />
      </TableCell>
      <TableCell className="text-on-surface-variant">{documentsSummary(row)}</TableCell>
    </TableRow>
  );
}

function HoldingsTable({ groups, imageOrigins, filtered }: GroupsProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableCaption className="sr-only">
          Your works and purchases, newest first. Each row links to the work's page.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Work</TableHead>
            <TableHead scope="col">Product</TableHead>
            <TableHead scope="col">Acquired</TableHead>
            <TableHead scope="col" className="text-right">
              Paid
            </TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Documents</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) =>
            group.rows.length === 1 ? (
              <SingleRow key={group.key} row={group.lead} imageOrigins={imageOrigins} />
            ) : (
              <HoldingGroupTable
                key={`${group.key}:${filtered}`}
                group={group}
                imageOrigins={imageOrigins}
                defaultOpen={filtered}
              />
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SingleCard({ row, imageOrigins }: { row: HoldingRowVm; imageOrigins: readonly string[] }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-border-hairline bg-surface p-4">
      <WorkThumbnail
        src={safeImageUrl(row.item.image, imageOrigins)}
        className="size-16 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <WorkTitle row={row} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductBadge product={row.item.product} />
          <PortfolioStatusBadge status={row.item.status} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-on-surface-variant">Acquired</dt>
          <dd>{formatDate(row.item.acquiredAt)}</dd>
          <dt className="text-on-surface-variant">{amountLabel(row.item.status)}</dt>
          <dd>
            <CurrencyAmounts totals={amountsOf(row)} />
            <InReviewNote row={row} />
          </dd>
          <dt className="text-on-surface-variant">Documents</dt>
          <dd>{documentsSummary(row)}</dd>
        </dl>
      </div>
    </li>
  );
}

function HoldingsCards({ groups, imageOrigins, filtered }: GroupsProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label="Works and purchases">
      {groups.map((group) =>
        group.rows.length === 1 ? (
          <SingleCard key={group.key} row={group.lead} imageOrigins={imageOrigins} />
        ) : (
          <HoldingGroupPhoneCard
            key={`${group.key}:${filtered}`}
            group={group}
            imageOrigins={imageOrigins}
            defaultOpen={filtered}
          />
        ),
      )}
    </ul>
  );
}

function AllocationLine({ label, counts }: { label: string; counts: AllocationCount[] }) {
  if (counts.length === 0) return null;
  return (
    <p className="text-xs text-on-surface-variant">
      <span className="font-medium">{label}:</span>{" "}
      <ProductText text={counts.map((entry) => `${entry.label} ${entry.count}`).join(" · ")} />
    </p>
  );
}

function toFields(options: FilterOptions, filter: HoldingsFilter): FilterFieldVm[] {
  return [
    {
      name: "status",
      label: "Status",
      value: filter.statuses?.[0] ?? "",
      options: LAX_PORTFOLIO_ITEM_STATUSES.map((value) => ({
        value,
        label: STATUS_LABELS[value],
      })),
    },
    {
      name: "product",
      label: "Product",
      value: filter.products?.[0] ?? "",
      options: LAX_PRODUCT_IDS.map((value) => ({ value, label: PRODUCT_LABELS[value] })),
    },
    {
      name: "artist",
      label: "Artist",
      value: filter.artist ?? "",
      options: options.artists.map((value) => ({ value, label: value })),
    },
    {
      name: "year",
      label: "Year acquired",
      chipPrefix: "Acquired in",
      value: filter.year === undefined ? "" : String(filter.year),
      options: options.years.map((year) => ({ value: String(year), label: String(year) })),
    },
    {
      name: "currency",
      label: "Currency",
      value: filter.currency ?? "",
      options: options.currencies.map((value) => ({ value, label: value })),
    },
  ];
}

/**
 * Search and filters, the works as a table (cards on a phone) with copies of one artwork in one
 * row that expands, and counts by artist.
 */
/** True when a search or filter is narrowing the list. */
function isFiltered(filter: HoldingsFilter): boolean {
  return Boolean(
    filter.search?.trim() ||
      filter.statuses?.length ||
      filter.products?.length ||
      filter.artist ||
      filter.year !== undefined ||
      filter.currency,
  );
}

export function PortfolioHoldings({
  holdings,
  options,
  filter,
  action,
  totalCount,
  imageOrigins,
}: {
  holdings: HoldingsVm;
  options: FilterOptions;
  filter: HoldingsFilter;
  action: string;
  /** How many works exist before any filter, so the count can say "3 of 12". */
  totalCount: number;
  imageOrigins: readonly string[];
}) {
  const groups = groupHoldingRows(holdings.rows);
  const filtered = isFiltered(filter);
  return (
    <section aria-labelledby="portfolio-holdings-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-holdings-heading" className={SECTION_TITLE}>
        Works and purchases
      </h2>
      <FilterToolbar
        action={action}
        noun="works"
        search={{
          name: "q",
          value: filter.search ?? "",
          label: "Search your works by title or artist",
          placeholder: "Search works",
        }}
        fields={toFields(options, filter)}
        shown={holdings.rows.length}
        total={totalCount}
        countText={holdingsCountLine(holdings.rows.length, totalCount, groups.length)}
      />
      {holdings.noResults ? (
        <EmptyState
          illustration="search"
          className={EMPTY_STATE}
          headingLevel="h3"
          title="No works match these filters"
          description="Try a different filter, or clear them to see every work."
          action={
            <a href={action} className="inline-flex min-h-11 items-center underline">
              Clear all filters
            </a>
          }
        />
      ) : (
        <>
          <HoldingsTable groups={groups} imageOrigins={imageOrigins} filtered={filtered} />
          <HoldingsCards groups={groups} imageOrigins={imageOrigins} filtered={filtered} />
          <AllocationLine label="By artist" counts={holdings.allocation.byArtist} />
        </>
      )}
    </section>
  );
}
