import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { SellerReofferAnswer } from "@/components/dashboard/seller/seller-reoffer-answer";
import { unsoldPausedContact } from "@/lib/presenters/organisation-state/organisation-state-copy";
import type { SellerReofferChip, SellerReofferVm } from "@/lib/seller/seller-reoffer.vm";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Notice } from "@auction/ui/lax/notice";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { pageTitleClass } from "@auction/ui/lax/styles";

function Chip({ chip }: { chip: SellerReofferChip }) {
  return (
    <StatusBadge tone={chip.tone} shape={chip.shape}>
      {chip.label}
    </StatusBadge>
  );
}

/** The figures the seller decides on: what the offer pays them, against the original sale. */
function Proceeds({ money }: { money: NonNullable<SellerReofferVm["money"]> }) {
  return (
    <WorkspacePanel title="What it means for you">
      <dl className="flex flex-col gap-3 text-lax-14">
        {money.rows.map((row) => (
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
      <p className="mt-4 text-lax-13 text-lax-muted">{money.note}</p>
    </WorkspacePanel>
  );
}

/**
 * One request to sell the seller's lot at the next bidder's price, in whatever state it is in:
 * what happened and what is asked, the buttons only while it waits and only for a member who may
 * answer, and the proceeds while they still matter. It never names either bidder.
 */
export function SellerReofferView({ vm }: { vm: SellerReofferVm }) {
  const { card, money } = vm;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className={pageTitleClass} data-page-title="">
            {vm.lotTitle}
          </h1>
          <p className="mt-1 text-lax-14 text-lax-muted">{vm.subtitle}</p>
        </div>
        {vm.chip ? (
          <div className="shrink-0">
            <Chip chip={vm.chip} />
          </div>
        ) : null}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WorkspacePanel title={card.heading} className="flex flex-col">
          <div className="flex flex-col gap-4">
            {card.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-lax-14 text-lax-fg">
                {paragraph}
              </p>
            ))}
            {card.notice ? (
              <Notice tone={card.notice.tone} title={card.notice.title}>
                {card.notice.detail}
              </Notice>
            ) : null}
            {card.answerable ? (
              <SellerReofferAnswer
                reofferId={vm.id}
                lotTitle={vm.lotTitle}
                offer={vm.offer}
                consent={vm.consent}
              />
            ) : null}
            {card.contact ? (
              <div>
                <ButtonLink href={unsoldPausedContact().href}>Contact us</ButtonLink>
              </div>
            ) : null}
          </div>
        </WorkspacePanel>
        {money ? <Proceeds money={money} /> : null}
      </div>
    </div>
  );
}
