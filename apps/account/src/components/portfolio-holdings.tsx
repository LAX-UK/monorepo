import { EMPTY_STATE, SECTION_TITLE } from "@/components/account-ui";
import type { FilterFieldVm } from "@/lib/filter-query";
import { formatDate } from "@/lib/format-money";
import { safeImageUrl } from "@/lib/media-origins";
import { PRODUCT_LABELS, STATUS_LABELS } from "@/server/domain/portfolio-labels";
import { workDetailHref } from "@/server/domain/portfolio-routes";
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
import {
  CurrencyAmounts,
  PortfolioStatusBadge,
  ProductBadge,
  WorkThumbnail,
} from "./portfolio-parts";
import { ProductText } from "./product-name";

type FilterOptions = ReturnType<typeof holdingsFilterOptions>;

function documentsSummary(row: HoldingRowVm): string {
  const { documentsAvailable: available, documentsExpected: expected } = row;
  if (available === 0 && expected === 0) return "None";
  const parts = [];
  if (available > 0) parts.push(`${available} available`);
  if (expected > 0) parts.push(`${expected} expected`);
  return parts.join(", ");
}

function WorkTitle({ row }: { row: HoldingRowVm }) {
  return (
    <>
      <a
        href={workDetailHref(row.item)}
        className="inline-flex min-h-11 items-center font-medium break-words text-on-surface underline underline-offset-4"
      >
        {row.item.title || "Untitled work"}
      </a>
      {row.item.artist ? (
        <span className="block text-xs text-on-surface-variant">{row.item.artist}</span>
      ) : null}
    </>
  );
}

function PaidCell({ row }: { row: HoldingRowVm }) {
  return (
    <>
      {row.item.status === "awaiting_payment" && row.paid.length > 0 ? (
        <span className="mr-1 text-xs text-on-surface-variant">Due</span>
      ) : null}
      <CurrencyAmounts totals={row.paid} />
    </>
  );
}

function HoldingsTable({
  rows,
  imageOrigins,
}: { rows: HoldingRowVm[]; imageOrigins: readonly string[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableCaption className="sr-only">
          Your works, newest first. Each row links to the work's page.
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
          {rows.map((row) => (
            <TableRow key={row.key}>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HoldingsCards({
  rows,
  imageOrigins,
}: { rows: HoldingRowVm[]; imageOrigins: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden" aria-label="Your works">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex gap-3 rounded-2xl border border-border-hairline bg-surface p-4"
        >
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
              <dt className="text-on-surface-variant">
                {row.item.status === "awaiting_payment" ? "Due" : "Paid"}
              </dt>
              <dd>
                <CurrencyAmounts totals={row.paid} />
              </dd>
              <dt className="text-on-surface-variant">Documents</dt>
              <dd>{documentsSummary(row)}</dd>
            </dl>
          </div>
        </li>
      ))}
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

/** Search and filters, the works as a table (cards on a phone), and counts by artist and product. */
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
  return (
    <section aria-labelledby="portfolio-holdings-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-holdings-heading" className={SECTION_TITLE}>
        Your works
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
      />
      {holdings.noResults ? (
        <EmptyState
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
          <HoldingsTable rows={holdings.rows} imageOrigins={imageOrigins} />
          <HoldingsCards rows={holdings.rows} imageOrigins={imageOrigins} />
          <div className="flex flex-col gap-1">
            <AllocationLine label="By artist" counts={holdings.allocation.byArtist} />
            <AllocationLine
              label="By product"
              counts={holdings.allocation.byProduct.map((entry) => ({
                ...entry,
                label: PRODUCT_LABELS[entry.label as keyof typeof PRODUCT_LABELS] ?? entry.label,
              }))}
            />
          </div>
        </>
      )}
    </section>
  );
}
