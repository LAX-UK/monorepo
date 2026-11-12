import { artworkMoveTitle } from "@/lib/admin/private-sales/deal-artwork.vm";
import {
  CHECK_LABELS,
  DEAL_STAGE_LABELS,
  TERM_LABELS,
  formatBps,
  policyGapSentence,
} from "@/lib/admin/private-sales/private-sales.vm";
import type { DealParty, DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import {
  type KeyValueItem,
  KeyValueList,
  Notice,
  Section,
  StatusBadge,
  type TimelineEvent,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import { TextLink } from "@auction/staff-ui";
import Link from "next/link";
import type * as React from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

const NOT_CONFIGURED = "Terms not configured";

const UNLINKED_REASON_LABEL = {
  sellers_own_work: "The seller's own work",
  in_zoho_not_linked: "In Zoho, but not linked yet",
} as const;

function Check({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <StatusBadge tone={tone}>{children}</StatusBadge>;
}

const KYC_TONE = { clear: "success", pending: "neutral", failed: "danger" } as const;
const AML_TONE = {
  clear: "success",
  pending: "neutral",
  review: "warning",
  blocked: "danger",
} as const;
const SOF_TONE = {
  approved: "success",
  pending: "warning",
  declined: "danger",
  not_requested: "neutral",
} as const;

function money(minor: number | null | undefined, fallback = NOT_CONFIGURED): React.ReactNode {
  return minor === null || minor === undefined ? (
    <span className="text-staff-muted">{fallback}</span>
  ) : (
    formatStaffMoney(minor)
  );
}

/** The configuration that is still missing, said once at the top of the record. */
export function PolicyNotice({ deal }: { deal: DealRecord }) {
  if (deal.policy.gaps.length === 0) return null;
  return (
    <Notice tone="warning" title="Terms not configured">
      A real deal can't be agreed or invoiced until {policyGapSentence(deal.policy.gaps)}{" "}
      {deal.policy.gaps.length === 1 ? "is" : "are"} set up. You can still work on this deal, and
      each step says what it is waiting for.
    </Notice>
  );
}

export function ClosedNotice({ deal }: { deal: DealRecord }) {
  if (deal.stage !== "cancelled") return null;
  return (
    <Notice tone="info" title="Cancelled">
      {deal.cancelledAt ? `Cancelled on ${formatStaffDateTime(deal.cancelledAt)}. ` : ""}
      {deal.cancelReason ? `Reason: ${deal.cancelReason}` : ""}
    </Notice>
  );
}

function vatLabel(deal: DealRecord): React.ReactNode {
  if (deal.vatTreatment === null) {
    return deal.policy.gaps.includes("vat_treatments") ? (
      <span className="text-staff-muted">{NOT_CONFIGURED}</span>
    ) : (
      <span className="text-staff-muted">To be set by finance</span>
    );
  }
  return (
    deal.policy.vatTreatments.find((t) => t.code === deal.vatTreatment)?.label ?? deal.vatTreatment
  );
}

export function termsItems(deal: DealRecord): KeyValueItem[] {
  const items: KeyValueItem[] = [
    {
      label: TERM_LABELS.priceMinor,
      value: money(deal.priceMinor, "Not agreed yet"),
      numeric: deal.priceMinor !== null,
    },
    {
      label: TERM_LABELS.buyerFeeBps,
      value: deal.buyerFeeBps === 0 ? "None" : formatBps(deal.buyerFeeBps),
    },
    {
      label: TERM_LABELS.sellerCommissionBps,
      value:
        deal.sellerCommissionBps === null ? (
          <span className="text-staff-muted">{NOT_CONFIGURED}</span>
        ) : (
          formatBps(deal.sellerCommissionBps)
        ),
    },
    {
      label: TERM_LABELS.costsMinor,
      value: deal.costsMinor === 0 ? "None" : formatStaffMoney(deal.costsMinor),
      numeric: deal.costsMinor !== 0,
    },
    { label: TERM_LABELS.vatTreatment, value: vatLabel(deal) },
    {
      label: TERM_LABELS.partiesDisclosed,
      value: deal.partiesDisclosed ? "Yes" : "No. Each side sees the other as LAX.",
    },
  ];
  if (deal.offerExpiresAt) {
    items.push({
      label: TERM_LABELS.offerExpiresAt,
      value: formatStaffDateTime(deal.offerExpiresAt),
    });
  }
  if (deal.paymentDueAt) {
    items.push({ label: "Payment due", value: formatStaffDateTime(deal.paymentDueAt) });
  }
  if (deal.collectionDueAt) {
    items.push({ label: "Collection due", value: formatStaffDateTime(deal.collectionDueAt) });
  }
  if (deal.invoiceReference) {
    items.push({
      label: "Invoice",
      value: deal.invoiceReference,
      copyValue: deal.invoiceReference,
    });
  }
  return items;
}

export function TermsSection({
  deal,
  action,
}: {
  deal: DealRecord;
  action?: React.ReactNode;
}) {
  return (
    <Section
      id="terms"
      title="Terms"
      description="The price, the fees and the arrangements both sides have agreed."
      {...(action ? { action } : {})}
    >
      <KeyValueList items={termsItems(deal)} />
    </Section>
  );
}

/** What the buyer pays and what the seller receives, line by line, from the shared calculator. */
export function MoneySection({ deal }: { deal: DealRecord }) {
  const money_ = deal.money;
  if (!money_) {
    return (
      <Section id="money" title="Money">
        <p className="m-0 text-staff-sm text-staff-muted">
          Money lines appear once a price is set.
        </p>
      </Section>
    );
  }
  const payment = deal.payment;
  return (
    <Section id="money" title="Money" description="What each side sees is their own lines only.">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="m-0 mb-1 text-staff-sm font-semibold text-staff-fg">The buyer pays</h3>
          <KeyValueList
            items={[
              { label: "Price", value: formatStaffMoney(money_.priceMinor), numeric: true },
              {
                label: "Buyer's fee",
                value: money_.buyerFeeMinor === 0 ? "None" : formatStaffMoney(money_.buyerFeeMinor),
                numeric: money_.buyerFeeMinor !== 0,
              },
              {
                label: "Total due",
                value: <strong>{formatStaffMoney(money_.totalDueMinor)}</strong>,
                numeric: true,
              },
            ]}
          />
        </div>
        <div>
          <h3 className="m-0 mb-1 text-staff-sm font-semibold text-staff-fg">
            The seller receives
          </h3>
          <KeyValueList
            items={[
              { label: "Price", value: formatStaffMoney(money_.priceMinor), numeric: true },
              {
                label: "Commission",
                value: money(
                  money_.sellerCommissionMinor === null ? null : -money_.sellerCommissionMinor,
                ),
                numeric: money_.sellerCommissionMinor !== null,
              },
              {
                label: "Costs",
                value: money_.costsMinor === 0 ? "None" : formatStaffMoney(-money_.costsMinor),
                numeric: money_.costsMinor !== 0,
              },
              {
                label: "Net to the seller",
                value:
                  money_.netToSellerMinor === null ? (
                    money(null)
                  ) : (
                    <strong>{formatStaffMoney(money_.netToSellerMinor)}</strong>
                  ),
                numeric: money_.netToSellerMinor !== null,
              },
            ]}
          />
        </div>
      </div>
      {payment ? (
        <div className="mt-4 border-t border-staff-line-subtle pt-3">
          <KeyValueList
            items={[
              {
                label: "Payment",
                value: `${PAYMENT_STATUS[payment.status] ?? payment.status} · ${formatStaffMoney(payment.amountMinor)} by ${payment.rail === "card" ? "card" : "bank transfer"}`,
              },
              ...(payment.paidAt
                ? [{ label: "Paid", value: formatStaffDateTime(payment.paidAt) }]
                : []),
              ...(payment.recordedTransfer
                ? [{ label: "Recorded by", value: "Finance, from the bank statement" }]
                : []),
              ...(payment.refundedMinor > 0
                ? [
                    {
                      label: "Returned to the buyer",
                      value:
                        payment.status === "refunded"
                          ? formatStaffMoney(payment.refundedMinor)
                          : `${formatStaffMoney(payment.refundedMinor)} of ${formatStaffMoney(payment.amountMinor)}`,
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ) : null}
    </Section>
  );
}

const PAYMENT_STATUS: Record<string, string> = {
  open: "Checkout open",
  processing: "Bank transfer on its way",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

/** Whether this person may see how the checks stand; finance and fulfilment work without them. */
export const checksVisible = (deal: DealRecord): boolean => deal.sourceOfFunds !== null;

function PartyChecks({ party, deal }: { party: DealParty; deal: DealRecord }) {
  const sof = deal.sourceOfFunds;
  const checkItems: KeyValueItem[] = [
    {
      label: "Identity",
      value: party.kyc ? (
        <Check tone={KYC_TONE[party.kyc]}>{CHECK_LABELS.kyc[party.kyc]}</Check>
      ) : (
        <span className="text-staff-muted">No account to check</span>
      ),
    },
    {
      label: "Screening",
      value: party.aml ? (
        <Check tone={AML_TONE[party.aml]}>{CHECK_LABELS.aml[party.aml]}</Check>
      ) : (
        <span className="text-staff-muted">No account to check</span>
      ),
    },
  ];
  const items: KeyValueItem[] = [
    ...(sof ? checkItems : []),
    {
      label: "Terms",
      value: deal.policy.termsVersion ? (
        party.accepted ? (
          <Check tone="success">Accepted</Check>
        ) : (
          <Check tone="neutral">Not accepted yet</Check>
        )
      ) : (
        <span className="text-staff-muted">{NOT_CONFIGURED}</span>
      ),
    },
  ];
  if (party.role === "buyer" && sof) {
    items.push({
      label: "Source of funds",
      value: sof.required ? (
        <Check tone={SOF_TONE[sof.status]}>{CHECK_LABELS.sourceOfFunds[sof.status]}</Check>
      ) : (
        <span className="text-staff-muted">
          Not needed below {formatStaffMoney(sof.thresholdMinor)}
        </span>
      ),
    });
  }
  return <KeyValueList items={items} />;
}

/** Both sides and their checks, read live. Staff never decide a check here: Compliance does. */
export function PartiesSection({ deal }: { deal: DealRecord }) {
  return (
    <Section
      id="parties"
      title={checksVisible(deal) ? "Parties and checks" : "Parties"}
      description={
        checksVisible(deal) ? (
          <>
            Read from the existing records. Compliance decides them, in{" "}
            <TextLink href="/admin/compliance/aml" Link={Link}>
              AML screening
            </TextLink>{" "}
            and{" "}
            <TextLink href="/admin/compliance/source-of-funds" Link={Link}>
              Source of funds
            </TextLink>
            .
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {[deal.seller, deal.buyer].map((party) =>
          party ? (
            <div key={party.role}>
              <h3 className="m-0 text-staff-sm font-semibold text-staff-fg">
                {party.role === "seller" ? "Seller" : "Buyer"}
                <span className="font-normal text-staff-muted"> · {party.displayName}</span>
              </h3>
              <PartyChecks party={party} deal={deal} />
            </div>
          ) : (
            <div key="buyer-missing">
              <h3 className="m-0 text-staff-sm font-semibold text-staff-fg">Buyer</h3>
              <p className="m-0 mt-1 text-staff-sm text-staff-muted">
                The buyer isn't named. Their identity and funds are checked once there is one.
              </p>
            </div>
          ),
        )}
      </div>
    </Section>
  );
}

const DOCUMENT_KIND: Record<string, string> = {
  terms: "Private sale terms",
  nda: "Non-disclosure agreement",
  condition_report: "Condition report",
  provenance: "Provenance",
  invoice: "Invoice",
  other: "Document",
};

/** The terms both sides accept in the product, and any other document held for the deal. */
export function DocumentsSection({ deal }: { deal: DealRecord }) {
  const version = deal.policy.termsVersion;
  const acceptedAt = (legalEntityId: string | undefined) =>
    deal.documents.find(
      (d) =>
        d.kind === "terms" &&
        d.version === version &&
        d.legalEntityId === legalEntityId &&
        d.acceptedAt !== null,
    )?.acceptedAt ?? null;
  const items: KeyValueItem[] = [
    {
      label: "Terms version",
      value: version ?? <span className="text-staff-muted">{NOT_CONFIGURED}</span>,
    },
  ];
  if (version) {
    const seller = acceptedAt(deal.seller.legalEntityId);
    const buyer = acceptedAt(deal.buyer?.legalEntityId);
    items.push(
      {
        label: "Seller accepted",
        value: seller ? (
          formatStaffDateTime(seller)
        ) : (
          <span className="text-staff-muted">Not yet</span>
        ),
      },
      {
        label: "Buyer accepted",
        value: !deal.buyer ? (
          <span className="text-staff-muted">No buyer named yet</span>
        ) : buyer ? (
          formatStaffDateTime(buyer)
        ) : (
          <span className="text-staff-muted">Not yet</span>
        ),
      },
    );
  }
  const others = deal.documents.filter((d) => d.kind !== "terms");
  for (const document of others) {
    items.push({
      label: DOCUMENT_KIND[document.kind] ?? "Document",
      value: document.version ? `Version ${document.version}` : "Held for this deal",
    });
  }
  return (
    <Section id="documents" title="Documents" description="Accepted in the product, with the time.">
      <KeyValueList items={items} />
    </Section>
  );
}

/** The reason given and the artwork's stock code: what the history line adds to its title. */
function artworkMoveDetail(move: DealRecord["artworkMoves"][number]): string | null {
  const parts = [
    move.to ? move.to.stockCode : null,
    move.action === "removed" && move.toUnlinkedReason
      ? UNLINKED_REASON_LABEL[move.toUnlinkedReason]
      : null,
    move.reason,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The deal's own history: each stage it entered, who moved it and why. */
export function dealTimeline(deal: DealRecord): TimelineEvent[] {
  const artwork: TimelineEvent[] = deal.artworkMoves.map((move, index) => ({
    id: `artwork-${index}`,
    title: artworkMoveTitle(move),
    at: move.createdAt,
    actor: move.actorName ?? "System",
    ...(artworkMoveDetail(move) ? { detail: artworkMoveDetail(move) as string } : {}),
    tone: "info" as const,
  }));
  const stages = deal.timeline.map((entry, index) => ({
    id: `${index}-${entry.toStage}`,
    title:
      entry.fromStage === null ? "Deal opened" : `Moved to ${DEAL_STAGE_LABELS[entry.toStage]}`,
    at: entry.createdAt,
    actor: entry.actorName ?? "System",
    ...(entry.reason ? { detail: entry.reason } : {}),
    tone: (entry.toStage === "cancelled"
      ? "neutral"
      : entry.toStage === "settled" || entry.toStage === "paid"
        ? "success"
        : "info") as NonNullable<TimelineEvent["tone"]>,
  }));
  return [...stages, ...artwork].sort((a, b) => b.at.localeCompare(a.at));
}
