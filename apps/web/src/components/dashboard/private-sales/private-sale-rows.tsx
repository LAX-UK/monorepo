"use client";

import { RowStep } from "@/components/workspace/row-step";
import type { PartyDealRow } from "@/lib/private-sales/party-deals.schema";
import {
  needStep,
  privateSaleHref,
  rowFigure,
  stageBadge,
} from "@/lib/private-sales/party-deals.vm";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { RecordList, RecordRow } from "@auction/ui/components/record-row";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import Link from "next/link";

function PrivateSaleRow({ row }: { row: PartyDealRow }) {
  const badge = stageBadge(row.role, row.stage);
  const step = row.needs ? needStep(row.needs, row.reference) : null;
  const figure = rowFigure(row);
  return (
    <RecordRow
      aria-label={`${row.workTitle}, private sale, ${badge.label}`}
      href={privateSaleHref(row.reference)}
      linkAs={Link}
      title={row.workTitle}
      meta={[
        "Private sale",
        row.workReference,
        row.role === "buyer" && row.stage === "invoiced" && row.paymentDueAt
          ? `Pay by ${formatDateTime(row.paymentDueAt)}`
          : null,
      ]}
      {...(figure
        ? {
            figures: [{ value: formatMoney(figure.value / 100), label: figure.label }],
            aligned: true,
          }
        : {})}
      status={
        <StatusBadge tone={badge.tone} shape={badge.shape}>
          {badge.label}
        </StatusBadge>
      }
      action={
        step ? (
          <RowStep label={step.label} accessibleName={step.accessibleName} href={step.href} />
        ) : null
      }
      needsYou={step !== null}
    />
  );
}

/**
 * The person's private sales as rows in the list they already use: a buyer's under Purchases and
 * a seller's under Consignments. A deal is one row with a "Private sale" tag in its details and
 * the one thing the person has to do next. Nothing is shown when there are none.
 */
export function PrivateSaleRows({
  rows,
  heading,
}: {
  rows: readonly PartyDealRow[];
  heading: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <h2 className="m-0 text-lax-16 font-semibold text-lax-fg">{heading}</h2>
      <RecordList aria-label={heading}>
        {rows.map((row) => (
          <PrivateSaleRow key={row.reference} row={row} />
        ))}
      </RecordList>
    </section>
  );
}
