import { type NeedsYouRowView, needsYouDue } from "@/lib/organisation-home/needs-you-view";
import { payHref } from "@/lib/pay/pay-links";
import type { PurchaseCardVm, PurchasesVm } from "@/lib/purchases/purchases.vm";
import { formatDateInline } from "@/lib/ui/format";

/**
 * A person's own Needs action, driven by money like an organisation's Needs you: amounts to pay
 * with their due dates (soonest first), then payments waiting on the bank, then holds that stop
 * a payment. It reads the cards Purchases draws, from the same amounts-owed reading the Pay page
 * and the header chip use, so every figure and date here is the one Purchases shows. A purchase
 * the person won for an organisation is that organisation's to pay and is never listed.
 */
export function personalNeedsActionRows(
  purchases: Pick<PurchasesVm, "cardsByTab"> & { payNow?: PurchasesVm["payNow"] },
  ctx: { now: Date },
): NeedsYouRowView[] {
  const cards = [
    ...new Map(
      Object.values(purchases.cardsByTab)
        .flat()
        .filter((card) => !card.informed)
        .map((card) => [card.lotId, card] as const),
    ).values(),
  ];
  const byDue = (a: PurchaseCardVm, b: PurchaseCardVm) => a.dueAt - b.dueAt;
  const documents = purchases.payNow?.documentsAction ?? null;

  const toPay = cards.filter((card) => card.state === "payment-due" && card.payable !== null);
  const waiting = cards.filter((card) => card.state === "payment-processing");
  const held = cards.filter((card) => card.state === "in-review");

  return [
    ...toPay.sort(byDue).map((card) => payRow(card, ctx.now)),
    // Money still to send comes before a payment that only needs confirming.
    ...waiting
      .sort((a, b) => Number(isStillToSend(b)) - Number(isStillToSend(a)) || byDue(a, b))
      .map(waitingRow),
    ...held.sort(byDue).map((card) => holdRow(card, documents)),
  ];
}

const tally = { section: "purchases", items: 1, raised: null } as const;

function subjectOf(card: PurchaseCardVm): string {
  return [card.saleTitle, card.lotLabel].filter(Boolean).join(" · ");
}

function payRow(card: PurchaseCardVm, now: Date): NeedsYouRowView {
  const dueAt = new Date(card.dueAt);
  return {
    key: `pay:${card.lotId}`,
    topic: "purchase",
    title: `Pay ${card.amount} for “${card.title}”`,
    detail: [card.statusNote, subjectOf(card)].filter(Boolean).join(" · "),
    due: needsYouDue(dueAt, `Due ${formatDateInline(dueAt)}`, now),
    action: { label: "Pay", href: payHref([card.lotId]) },
    ...tally,
  };
}

const isStillToSend = (card: PurchaseCardVm) =>
  card.primaryAction !== null && card.statusLabel === "Still to send";

/** A transfer part-paid says what is left to send; any other payment says it is being confirmed. */
function waitingRow(card: PurchaseCardVm): NeedsYouRowView {
  const stillToSend = isStillToSend(card);
  return {
    key: `waiting:${card.lotId}`,
    topic: "purchase",
    title: stillToSend ? (card.statusNote ?? "Still to send") : `Payment for “${card.title}”`,
    detail: stillToSend
      ? `For “${card.title}”. Nothing is paid until all of it arrives.`
      : `${card.amount} · being confirmed. We will tell you when it has cleared.`,
    due: null,
    action: card.primaryAction ?? { label: "View", href: card.detailHref },
    ...tally,
  };
}

/** The one place a hold asks for documents is the Purchases summary; the row sends there too. */
function holdRow(
  card: PurchaseCardVm,
  documents: { label: string; href: string } | null,
): NeedsYouRowView {
  return {
    key: `hold:${card.lotId}`,
    topic: "account",
    title: `Payment on hold for “${card.title}”`,
    detail: card.statusNote ?? "We're checking a few details before you can pay",
    due: null,
    action: documents ?? { label: "View", href: card.detailHref },
    ...tally,
  };
}
