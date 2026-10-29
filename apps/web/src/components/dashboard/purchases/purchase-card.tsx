"use client";

import { MediaImage } from "@/components/ui/media-image";
import type { PurchaseState } from "@/lib/purchases/purchase-progress";
import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { AccountProgress } from "@auction/marketing-ui";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill, type DotStatusPillTone } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

/** The four steps with the current one marked, then the price breakdown. */
function PurchaseDetail({ card }: { card: PurchaseCardVm }) {
  if (!card.steps && card.breakdown.length === 0) return null;
  return (
    <div className="flex flex-col gap-3 pt-1">
      {card.steps ? <AccountProgress label="Purchase progress" steps={card.steps} /> : null}
      {card.breakdown.length > 0 ? (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 font-body text-label-3 leading-5 text-on-surface-variant">
          {card.breakdown.map((item) => (
            <div key={item.label} className="flex gap-1.5">
              <dt>{item.label}</dt>
              <dd className="font-medium tabular-nums text-on-surface">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * One won lot from payment to delivery, as a row: the work, what is owed and its status, the one
 * next step, and the invoice and "Report a problem" in the "…" menu. Under it, the four steps
 * with the current one marked and the price breakdown.
 */
export function PurchaseCard({ card }: { card: PurchaseCardVm }) {
  const router = useRouter();
  const { primaryAction, invoiceHref, problemHref } = card;
  const menu: InlineActionMenuItem[] = [
    ...(invoiceHref
      ? [
          {
            type: "item" as const,
            label: "Download invoice",
            onSelect: () => window.location.assign(invoiceHref),
          },
        ]
      : []),
    ...(problemHref
      ? [
          {
            type: "item" as const,
            label: "Report a problem",
            onSelect: () => router.push(problemHref),
          },
        ]
      : []),
  ];

  return (
    <RecordRow
      aria-label={`${card.title}, ${card.statusLabel}`}
      href={card.href}
      linkAs={Link}
      leading={
        <RecordRowMedia>
          <MediaImage src={card.image} alt="" sizes="48px" />
        </RecordRowMedia>
      }
      title={card.title}
      meta={[card.lotLabel, card.saleTitle, card.statusNote]}
      status={<DotStatusPill label={card.statusLabel} tone={STATE_TONE[card.state]} />}
      value={
        <>
          <span className="font-normal text-on-surface-variant">{card.amountLabel} </span>
          {card.amount}
        </>
      }
      action={
        primaryAction ? (
          <Button variant="primary" size="default" asChild>
            <Link href={primaryAction.href} aria-label={`${primaryAction.label}, ${card.title}`}>
              {primaryAction.label}
            </Link>
          </Button>
        ) : null
      }
      menu={
        menu.length > 0 ? <InlineActionMenu label={`More for ${card.title}`} items={menu} /> : null
      }
      detail={card.steps || card.breakdown.length > 0 ? <PurchaseDetail card={card} /> : null}
    />
  );
}
