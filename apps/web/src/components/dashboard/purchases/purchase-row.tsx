"use client";

import { MediaImage } from "@/components/ui/media-image";
import type { PurchaseCardVm } from "@/lib/purchases/purchases.vm";
import { notify } from "@/lib/ui/notify";
import {
  InlineActionMenu,
  type InlineActionMenuItem,
  RecordRow,
  RecordRowMedia,
} from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import { StatusBadge } from "@auction/ui/lax";
import Link from "next/link";
import { useRouter } from "next/navigation";

async function copyReference(card: PurchaseCardVm) {
  const reference = [card.lotLabel, card.saleTitle, card.title].filter(Boolean).join(", ");
  try {
    await navigator.clipboard.writeText(reference);
    notify.success("Reference copied");
  } catch {
    notify.error("We couldn't copy the reference");
  }
}

/**
 * One won lot, as a row: the work, who won it, the total due or paid, and where it stands. The
 * row opens the purchase. A payer picks invoices to pay together with the box at its start.
 */
export function PurchaseRow({
  card,
  selection,
  selectColumn,
}: {
  card: PurchaseCardVm;
  /** Some row of the list can be picked, so every row keeps the box's column. */
  selectColumn: boolean;
  /** Set while the member can pick this invoice to pay together with others. */
  selection: { selected: boolean; onSelectedChange: (selected: boolean) => void } | null;
}) {
  const router = useRouter();
  const menu: InlineActionMenuItem[] = [
    { type: "item", label: "View purchase", onSelect: () => router.push(card.detailHref) },
    { type: "item", label: "View lot", onSelect: () => router.push(card.lotHref) },
    ...(card.invoiceHref
      ? [
          {
            type: "item" as const,
            label: "Invoice",
            onSelect: () => window.open(card.invoiceHref ?? "", "_blank", "noopener"),
          },
        ]
      : []),
    ...(card.problemHref
      ? [
          {
            type: "item" as const,
            label: "Report a problem",
            onSelect: () => router.push(card.problemHref ?? ""),
          },
        ]
      : []),
    { type: "separator" },
    { type: "item", label: "Copy reference", onSelect: () => void copyReference(card) },
  ];
  return (
    <RecordRow
      aria-label={`${card.title}, ${card.badge.label}`}
      href={card.detailHref}
      linkAs={Link}
      leading={
        <span className="flex items-center gap-3">
          {selection ? (
            <span className="relative z-10 -my-2 -ml-2 inline-flex size-11 items-center justify-center">
              <Checkbox
                checked={selection.selected}
                onCheckedChange={(checked) => selection.onSelectedChange(checked === true)}
                aria-label={`Pay ${card.title}`}
                className="size-5 rounded-[5px] border-lax-control-edge bg-lax-surface shadow-none data-[state=checked]:border-lax-ink data-[state=checked]:bg-lax-ink data-[state=checked]:text-lax-on-ink focus-visible:ring-lax-focus"
              />
            </span>
          ) : selectColumn ? (
            // Keeps the thumbnails in one column when other rows can be picked.
            <span aria-hidden className="-my-2 -ml-2 inline-flex size-11" />
          ) : null}
          <RecordRowMedia>
            <MediaImage src={card.image} alt="" sizes="48px" />
          </RecordRowMedia>
        </span>
      }
      title={card.title}
      meta={[card.lotLabel, card.saleTitle, card.wonBy ? `won by ${card.wonBy}` : null]}
      figures={[{ value: card.amount, label: card.amountLabel }]}
      aligned
      status={
        <StatusBadge tone={card.badge.tone} shape={card.badge.shape}>
          {card.badge.label}
        </StatusBadge>
      }
      menu={<InlineActionMenu label={`More for ${card.title}`} items={menu} />}
    />
  );
}
