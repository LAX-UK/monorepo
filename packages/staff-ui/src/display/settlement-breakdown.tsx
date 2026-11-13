import { formatDayMonth } from "@auction/datetime";
import { type LinkComponent, StatusBadge, type StatusBadgeTone } from "@auction/ui/lax";
import type * as React from "react";
import { EmptyValue } from "../data/cells.js";
import { cn } from "../lib/cn.js";
import { STAFF_TIME_ZONE, formatStaffExportDate, formatStaffMoney } from "../lib/format.js";
import { formatBpsAsPercent } from "../lib/percent.js";
import { TextLink } from "./text-link.js";

/** Where a sale stands for its seller, as the badge on the right of the breakdown says it. */
export type SettlementBreakdownStatus =
  | { readonly kind: "ready" }
  | { readonly kind: "waiting_for_buyer" }
  | { readonly kind: "paid_out"; readonly paidAt: Date | string }
  | { readonly kind: "held" }
  | { readonly kind: "recalculated" }
  | { readonly kind: "re_awarded" }
  | { readonly kind: "lax_owned" }
  | { readonly kind: "refunded_after_payout" }
  | { readonly kind: "settle_by_hand" };

/** Where the commission rate comes from: a signed agreement, or a figure staff recorded. */
export type SettlementRateSource =
  | {
      readonly kind: "agreement";
      /** The agreement's reference as staff know it: "C-1042". */
      readonly reference: string;
      readonly signedAt: Date | string;
      readonly href: string;
    }
  | { readonly kind: "recorded_by_staff" };

/** VAT on the commission: charged at a rate, or not charged because the company is not registered. */
export type SettlementVat =
  | { readonly kind: "charged"; readonly rateBps: number; readonly pence: number }
  | { readonly kind: "not_registered"; readonly companyName: string };

/**
 * The seller's side of one sale, every figure as the snapshot, the calculator or the payout line
 * holds it. The breakdown formats; it never works a figure out. `null` means "not priced yet"
 * (a held sale) and shows an em dash.
 */
export type SettlementBreakdownFigures = {
  readonly currency?: string;
  readonly hammerPence: number;
  readonly commission: { readonly rateBps: number; readonly pence: number } | null;
  readonly vat: SettlementVat | null;
  readonly netPence: number | null;
  /** True once the seller has been paid: the last line reads "Seller received". */
  readonly paidOut: boolean;
};

/** The buyer's premium, from the frozen invoice lines, never a default rate. */
export type SettlementPremium = {
  /** The rate as the invoice states it, already worded: "25%", or "tiered". */
  readonly rateLabel: string;
  /** What the buyer paid in all: hammer, premium and anything else on the invoice. */
  readonly buyerPaidPence: number;
};

export type SettlementBreakdownProps = SettlementBreakdownFigures & {
  readonly status: SettlementBreakdownStatus;
  readonly rateSource: SettlementRateSource | null;
  readonly premium: SettlementPremium | null;
  /** The app's router link, for the agreement. */
  readonly Link?: LinkComponent;
  /** A short note under the figures: why the sale was recalculated, what to do by hand. */
  readonly note?: React.ReactNode;
  /** One action under the note. */
  readonly action?: React.ReactNode;
  /** Reading date for "Paid out 13 Nov": the year shows only when it is not this one. */
  readonly now?: Date;
  readonly className?: string;
};

const STATUS: Record<SettlementBreakdownStatus["kind"], { label: string; tone: StatusBadgeTone }> =
  {
    ready: { label: "Ready for payout", tone: "info" },
    waiting_for_buyer: { label: "Waiting for the buyer", tone: "neutral" },
    paid_out: { label: "Paid out", tone: "success" },
    held: { label: "Payout held", tone: "danger" },
    recalculated: { label: "Recalculated", tone: "accepted" },
    re_awarded: { label: "Re-awarded", tone: "accepted" },
    lax_owned: { label: "LAX-owned", tone: "neutral" },
    refunded_after_payout: { label: "Refunded after payout", tone: "warning" },
    settle_by_hand: { label: "Settle by hand", tone: "warning" },
  };

/** The badge's words: "Paid out 13 Nov" carries its date. */
export function settlementStatusLabel(
  status: SettlementBreakdownStatus,
  now: Date = new Date(),
): string {
  const { label } = STATUS[status.kind];
  if (status.kind !== "paid_out") return label;
  const paidAt = status.paidAt instanceof Date ? status.paidAt : new Date(status.paidAt);
  if (Number.isNaN(paidAt.getTime())) return label;
  return `${label} ${formatDayMonth(paidAt, STAFF_TIME_ZONE, now)}`;
}

/** "Seller will receive" before the payout, "Seller received" after it. */
export function sellerReceivesLabel(paidOut: boolean): string {
  return paidOut ? "Seller received" : "Seller will receive";
}

function Row({
  label,
  value,
  emphasis = false,
  testId,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  emphasis?: boolean;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5",
        emphasis && "mt-1 border-t border-staff-line pt-2.5",
      )}
    >
      <dt className={cn("min-w-0", emphasis ? "font-medium text-staff-fg" : "text-staff-muted")}>
        {label}
      </dt>
      <dd
        className={cn(
          "shrink-0 text-right tabular-nums",
          emphasis ? "text-staff-md font-semibold text-staff-fg" : "text-staff-fg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function deduction(pence: number | null | undefined, currency: string): React.ReactNode {
  if (pence === null || pence === undefined) return <EmptyValue />;
  // A deduction reads as one, with a true minus sign; nothing is charged reads as plain zero.
  return formatStaffMoney(pence === 0 ? 0 : -pence, currency);
}

function RateSourceLine({ source, Link }: { source: SettlementRateSource; Link?: LinkComponent }) {
  if (source.kind === "recorded_by_staff") return <span>Recorded by staff</span>;
  return (
    <span>
      <TextLink href={source.href} {...(Link ? { Link } : {})}>
        Agreement {source.reference}
      </TextLink>{" "}
      · signed {formatStaffExportDate(source.signedAt)}
    </span>
  );
}

/**
 * The seller's side of one sale, read like a receipt: the hammer, the commission at its rate, the
 * VAT on that commission (or why there is none), and what the seller receives, with where the rate
 * came from and the sale's status on the right. A quiet last line says the buyer's premium is
 * LAX's and what the buyer paid, so nobody reads the premium into the seller's proceeds.
 */
export function SettlementBreakdown({
  currency = "GBP",
  hammerPence,
  commission,
  vat,
  netPence,
  paidOut,
  status,
  rateSource,
  premium,
  Link,
  note,
  action,
  now,
  className,
}: SettlementBreakdownProps) {
  const badge = STATUS[status.kind];
  return (
    <div
      data-staff-settlement={status.kind}
      className={cn(
        "flex flex-col rounded-staff-lg border border-staff-line bg-staff-surface text-staff-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <p className="min-w-0 text-staff-xs text-staff-muted">
            {rateSource ? <RateSourceLine source={rateSource} {...(Link ? { Link } : {})} /> : null}
          </p>
          <StatusBadge tone={badge.tone} className="ml-auto shrink-0">
            {settlementStatusLabel(status, now)}
          </StatusBadge>
        </div>
        <dl className="flex flex-col">
          <Row
            testId="hammer"
            label="Hammer price"
            value={formatStaffMoney(hammerPence, currency)}
          />
          <Row
            testId="commission"
            label={
              commission ? `Commission ${formatBpsAsPercent(commission.rateBps)}` : "Commission"
            }
            value={deduction(commission?.pence, currency)}
          />
          {vat?.kind === "not_registered" ? (
            <Row
              testId="vat"
              label={`No VAT: ${vat.companyName} is not VAT-registered`}
              value={formatStaffMoney(0, currency)}
            />
          ) : (
            <Row
              testId="vat"
              label={
                vat ? `VAT on commission ${formatBpsAsPercent(vat.rateBps)}` : "VAT on commission"
              }
              value={deduction(vat?.pence, currency)}
            />
          )}
          <Row
            testId="net"
            emphasis
            label={sellerReceivesLabel(paidOut)}
            value={netPence === null ? <EmptyValue /> : formatStaffMoney(netPence, currency)}
          />
        </dl>
        {note ? <div className="text-staff-sm text-staff-fg">{note}</div> : null}
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {premium ? (
        <p className="border-t border-staff-line-subtle px-4 py-2.5 text-staff-xs text-staff-muted">
          Buyer's premium {premium.rateLabel} is kept by LAX and isn't part of the seller's
          proceeds. The buyer paid {formatStaffMoney(premium.buyerPaidPence, currency)}.
        </p>
      ) : null}
    </div>
  );
}
