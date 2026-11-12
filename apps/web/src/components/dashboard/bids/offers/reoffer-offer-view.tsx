import { ReofferOfferAnswer } from "@/components/dashboard/bids/offers/reoffer-offer-answer";
import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { MediaImage } from "@/components/ui/media-image";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import type { BidderReofferChip, BidderReofferVm } from "@/lib/reoffer/bidder-reoffer.vm";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Notice } from "@auction/ui/lax/notice";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { pageTitleClass } from "@auction/ui/lax/styles";
import { Clock } from "lucide-react";
import Link from "next/link";

function Chip({ chip }: { chip: BidderReofferChip }) {
  if (chip.cue === "clock") {
    return (
      <StatusBadge tone={chip.tone} icon={<Clock aria-hidden className="size-3.5" />}>
        {chip.label}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone={chip.tone} shape={chip.cue}>
      {chip.label}
    </StatusBadge>
  );
}

/** The work on offer: its picture, title, lot and sale, and when its own sale ended. */
export function ReofferLotSummary({
  title,
  meta,
  image,
}: {
  title: string;
  meta: readonly string[];
  image: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden
        className="relative block size-16 shrink-0 overflow-hidden rounded-lax-control bg-lax-sunken shadow-[inset_0_0_0_1px_var(--lax-line)]"
      >
        <MediaImage src={image} alt="" sizes="64px" />
      </span>
      <div className="min-w-0">
        <p className="text-lax-16 font-semibold text-lax-fg">{title}</p>
        {meta.map((line) => (
          <p key={line} className="text-lax-13 text-lax-muted">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The figures the bidder agrees to: each line, then the total. */
function Price({ price }: { price: BidderReofferVm["price"] }) {
  return (
    <WorkspacePanel title="Price">
      <dl className="flex flex-col gap-3 text-lax-14">
        {price.rows.map((row) => (
          <div
            key={row.label}
            className={
              row.strong
                ? "flex items-baseline justify-between gap-4 border-t border-lax-line pt-3 font-semibold text-lax-fg"
                : "flex items-baseline justify-between gap-4 text-lax-muted"
            }
          >
            <dt>{row.label}</dt>
            <dd className="tabular-nums text-lax-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-lax-13 text-lax-muted">{price.note}</p>
    </WorkspacePanel>
  );
}

/**
 * One offer to buy a lot at the bidder's own bid, in whatever state it is in: the work and what is
 * offered, the terms box and the two answers only while it is open and only for a member who may
 * answer, and the price line by line in every state. It never names the seller or the buyer who
 * did not pay.
 */
export function ReofferOfferView({ vm }: { vm: BidderReofferVm }) {
  const { card } = vm;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className={pageTitleClass} data-page-title="">
            An offer for you
          </h1>
          <p className="mt-1 text-lax-14 text-lax-muted">{vm.subtitle}</p>
        </div>
        {vm.chip ? (
          <div className="flex shrink-0 flex-col gap-1 md:items-end">
            <Chip chip={vm.chip} />
            {vm.endsIn ? <p className="text-lax-13 text-lax-muted">{vm.endsIn}</p> : null}
          </div>
        ) : null}
      </div>

      {card.notice && card.state !== "open" ? (
        <Notice tone={card.notice.tone} alert title={card.notice.title}>
          {card.notice.detail}
        </Notice>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-label="The offer"
          className="flex flex-col gap-4 rounded-lax-card border border-lax-line bg-lax-surface p-5 md:p-6"
        >
          <ReofferLotSummary title={vm.lotTitle} meta={vm.lotMeta} image={vm.lotImage} />
          {card.heading ? (
            <h2 className="font-lax-display text-lax-18 font-semibold text-lax-fg">
              {card.heading}
            </h2>
          ) : null}
          {card.lead ? (
            <p className="text-lax-14 text-lax-fg">
              {card.lead.before}
              <strong className="font-semibold tabular-nums">{card.lead.amount}</strong>
              {card.lead.after}
            </p>
          ) : null}
          {card.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-lax-14 text-lax-fg">
              {paragraph}
            </p>
          ))}
          {card.notice && card.state === "open" ? (
            <Notice tone={card.notice.tone} title={card.notice.title}>
              {card.notice.detail}
            </Notice>
          ) : null}
          {card.answerable ? <ReofferOfferAnswer reofferId={vm.id} lotTitle={vm.lotTitle} /> : null}
          {card.purchaseHref || card.browse ? (
            <div>
              {card.purchaseHref ? (
                <ButtonLink variant="primary" href={card.purchaseHref} Link={Link}>
                  View your purchase
                </ButtonLink>
              ) : (
                <ButtonLink href={calendarSalesHref({ tab: "upcoming" })} Link={Link}>
                  Browse upcoming sales
                </ButtonLink>
              )}
            </div>
          ) : null}
        </section>
        <Price price={vm.price} />
      </div>
    </div>
  );
}
