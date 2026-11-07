import { formatDate } from "@/lib/format-date";
import { safeImageUrl } from "@/lib/media-origins";
import {
  type HoldingGroupVm,
  MIXED_STATUS_LABEL,
  copyLabel,
} from "@/server/domain/holding-groups.vm";
import { workDetailHref } from "@/server/domain/portfolio-routes";
import type { HoldingRowVm } from "@auction/lax-ecosystem";
import { TableCell, TableRow } from "@auction/ui/components/table";
import { HoldingGroupCard, HoldingGroupTableRows } from "./holding-group.client";
import { InReviewNote, PaidCell, documentsSummary } from "./holding-row-parts";
import {
  CurrencyAmounts,
  PortfolioStatusBadge,
  ProductBadge,
  WorkThumbnail,
} from "./portfolio-parts";

/** A copy's name in its group, linking to the copy's own page. */
function CopyLink({ row }: { row: HoldingRowVm }) {
  return (
    <a
      href={workDetailHref(row.item)}
      className="inline-flex min-h-11 items-center text-on-surface underline underline-offset-4"
    >
      {copyLabel(row.item)}
      <span className="sr-only"> of {row.item.title}</span>
    </a>
  );
}

function CopyTableRows({ rows }: { rows: HoldingRowVm[] }) {
  return rows.map((row) => (
    <TableRow key={row.key} className="bg-surface-container-low">
      <TableCell>
        <div className="pl-6 sm:pl-16">
          <CopyLink row={row} />
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="whitespace-nowrap">{formatDate(row.item.acquiredAt)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <PaidCell row={row} />
      </TableCell>
      <TableCell>
        <PortfolioStatusBadge status={row.item.status} />
      </TableCell>
      <TableCell className="text-on-surface-variant">{documentsSummary(row)}</TableCell>
    </TableRow>
  ));
}

function CopyCards({ rows }: { rows: HoldingRowVm[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border-hairline border-t border-border-hairline">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-3 py-1">
          <CopyLink row={row} />
          <PortfolioStatusBadge status={row.item.status} />
          <p className="basis-full pb-2 text-xs text-on-surface-variant">
            {formatDate(row.item.acquiredAt)} · <PaidCell row={row} />
          </p>
        </li>
      ))}
    </ul>
  );
}

/** What the group's copies add up to: paid so far, and what is still due on the rest. */
function GroupAmounts({ group }: { group: HoldingGroupVm }) {
  const onlyDue = group.paid.length === 0 && group.due.length > 0;
  const inReview = group.rows.find((row) => row.item.owed?.state === "in_review");
  return (
    <>
      {onlyDue ? <span className="mr-1 text-xs text-on-surface-variant">Due</span> : null}
      <CurrencyAmounts totals={onlyDue ? group.due : group.paid} />
      {group.paid.length > 0 && group.due.length > 0 ? (
        <span className="block text-xs text-on-surface-variant">
          Due <CurrencyAmounts totals={group.due} />
        </span>
      ) : null}
      {inReview ? <InReviewNote row={inReview} /> : null}
    </>
  );
}

function GroupStatus({ group }: { group: HoldingGroupVm }) {
  return (
    <PortfolioStatusBadge
      status={group.status}
      label={group.mixed ? MIXED_STATUS_LABEL : undefined}
    />
  );
}

type GroupViewProps = {
  group: HoldingGroupVm;
  imageOrigins: readonly string[];
  /** Open at first because a search or filter is narrowing the list to matching copies. */
  defaultOpen: boolean;
};

function groupParts({ group, imageOrigins }: GroupViewProps, size: string) {
  const { item } = group.lead;
  return {
    title: item.title,
    copyCount: group.rows.length,
    thumbnail: (
      <WorkThumbnail src={safeImageUrl(item.image, imageOrigins)} className={`${size} shrink-0`} />
    ),
    details: item.artist ? (
      <span className="block text-xs text-on-surface-variant">{item.artist}</span>
    ) : null,
  };
}

export function HoldingGroupTable(props: GroupViewProps) {
  const { group, defaultOpen } = props;
  return (
    <HoldingGroupTableRows
      {...groupParts(props, "size-12")}
      defaultOpen={defaultOpen}
      copies={<CopyTableRows rows={group.rows} />}
      cells={
        <>
          <TableCell>
            <ProductBadge product={group.lead.item.product} />
          </TableCell>
          <TableCell className="whitespace-nowrap">{formatDate(group.acquiredAt)}</TableCell>
          <TableCell className="text-right whitespace-nowrap">
            <GroupAmounts group={group} />
          </TableCell>
          <TableCell>
            <GroupStatus group={group} />
          </TableCell>
          <TableCell className="text-on-surface-variant">{documentsSummary(group)}</TableCell>
        </>
      }
    />
  );
}

export function HoldingGroupPhoneCard(props: GroupViewProps) {
  const { group, defaultOpen } = props;
  return (
    <HoldingGroupCard
      {...groupParts(props, "size-16")}
      defaultOpen={defaultOpen}
      copies={<CopyCards rows={group.rows} />}
      summary={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ProductBadge product={group.lead.item.product} />
            <GroupStatus group={group} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-on-surface-variant">Latest</dt>
            <dd>{formatDate(group.acquiredAt)}</dd>
            <dt className="text-on-surface-variant">Paid</dt>
            <dd>
              <GroupAmounts group={group} />
            </dd>
            <dt className="text-on-surface-variant">Documents</dt>
            <dd>{documentsSummary(group)}</dd>
          </dl>
        </>
      }
    />
  );
}
