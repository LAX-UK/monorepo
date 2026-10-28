import { MediaImage } from "@/components/ui/media-image";
import type { PurchaseState } from "@/lib/purchases/purchase-progress";
import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { AccountProgress } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill, type DotStatusPillTone } from "@auction/ui/components/dot-status-pill";
import { Download, Flag } from "lucide-react";
import Link from "next/link";

const STATE_TONE: Record<PurchaseState, DotStatusPillTone> = {
  "payment-due": "warning",
  "in-review": "warning",
  "payment-processing": "pending",
  "choose-delivery": "info",
  preparing: "pending",
  "ready-for-collection": "info",
  "in-transit": "pending",
  delivered: "success",
  collected: "success",
  refunded: "neutral",
  cancelled: "neutral",
};

function Breakdown({ items }: { items: PurchaseCardVm["breakdown"] }) {
  if (items.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-1 font-body text-sm text-on-surface-variant">
      {items.map((item) => (
        <div key={item.label} className="flex gap-1.5">
          <dt>{item.label}</dt>
          <dd className="font-medium tabular-nums text-on-surface">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Actions({ card }: { card: PurchaseCardVm }) {
  const { primaryAction, invoiceHref, problemHref } = card;
  if (!primaryAction && !invoiceHref && !problemHref) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      {primaryAction ? (
        <Button variant="primary" size="default" asChild>
          <Link href={primaryAction.href} aria-label={`${primaryAction.label}, ${card.title}`}>
            {primaryAction.label}
          </Link>
        </Button>
      ) : null}
      {invoiceHref ? (
        <Button variant="ghost" size="default" asChild>
          <a href={invoiceHref} aria-label={`Invoice for ${card.title}`}>
            <Download aria-hidden />
            Invoice
          </a>
        </Button>
      ) : null}
      {problemHref ? (
        <Button variant="ghost" size="default" asChild>
          <Link href={problemHref} aria-label={`Report a problem with ${card.title}`}>
            <Flag aria-hidden />
            Report a problem
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One won lot from payment to delivery: the work and what is owed, the four steps with the
 * current one marked, then the price breakdown, the invoice and "Report a problem".
 */
export function PurchaseCard({ card }: { card: PurchaseCardVm }) {
  const hasFooter =
    card.breakdown.length > 0 ||
    Boolean(card.primaryAction || card.invoiceHref || card.problemHref);
  return (
    <article
      aria-label={`${card.title}, ${card.statusLabel}`}
      className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest"
    >
      <div className="flex flex-col gap-5 p-4 md:p-5">
        <div className="flex items-start gap-4">
          <Link
            href={card.href}
            tabIndex={-1}
            aria-hidden
            className="relative size-18 shrink-0 overflow-hidden rounded-md bg-surface-container-high md:size-22"
          >
            <MediaImage src={card.image} alt="" label="Lot image" sizes="88px" />
          </Link>
          <div className="min-w-0 flex-1">
            {card.lotLabel || card.saleTitle ? (
              <p className="truncate font-body text-xs text-on-surface-variant">
                {card.lotLabel ? (
                  <span className="font-semibold text-on-surface">{card.lotLabel}</span>
                ) : null}
                {card.lotLabel && card.saleTitle ? <span aria-hidden> · </span> : null}
                {card.saleTitle}
              </p>
            ) : null}
            <h3 className="mt-1 font-headline text-base font-semibold leading-snug text-on-surface md:text-lg">
              <Link
                href={card.href}
                className="underline-offset-4 hover:underline focus-visible:underline"
              >
                {card.title}
              </Link>
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <DotStatusPill label={card.statusLabel} tone={STATE_TONE[card.state]} />
              {card.statusNote ? (
                <span className="font-body text-sm text-on-surface-variant">{card.statusNote}</span>
              ) : null}
            </div>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="font-body text-xs text-on-surface-variant">{card.amountLabel}</p>
            <p className="mt-1 font-headline text-xl font-semibold tabular-nums text-on-surface">
              {card.amount}
            </p>
          </div>
        </div>
        <p className="flex items-baseline justify-between font-body text-sm text-on-surface-variant sm:hidden">
          {card.amountLabel}
          <span className="font-headline text-lg font-semibold tabular-nums text-on-surface">
            {card.amount}
          </span>
        </p>
        {card.steps ? <AccountProgress label="Purchase progress" steps={card.steps} /> : null}
      </div>
      {hasFooter ? (
        <div className="flex flex-col gap-3 border-t border-outline-variant/40 bg-surface-container-low px-4 py-3 md:px-5 lg:flex-row lg:items-center lg:justify-between">
          <Breakdown items={card.breakdown} />
          <Actions card={card} />
        </div>
      ) : null}
    </article>
  );
}
