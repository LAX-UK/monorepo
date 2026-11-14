"use client";

import {
  EmailSendDetail,
  EmailSendsTable,
} from "@/components/admin/people/email-delivery/email-sends-table";
import { LiftEmailBlockDialog } from "@/components/admin/people/email-delivery/lift-email-block-dialog";
import {
  SENDS_COLLAPSED,
  buildEmailDeliveryPanelVm,
} from "@/lib/admin/email-delivery/email-delivery.vm";
import {
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  StatusBadge,
  useQueuePanel,
} from "@auction/staff-ui";
import type { EmailBlockView, PersonEmailDeliveryView } from "@auction/types";
import { useSearchParams } from "next/navigation";
import { type ComponentProps, useId, useMemo, useState } from "react";

/** The search param that holds the open email, on the person's page. */
export const EMAIL_SEND_PARAM = "emailSend";

type Props = {
  userId: string;
  personName: string;
  email: string;
  view: PersonEmailDeliveryView;
  viewerCanLift: boolean;
  lift?: ComponentProps<typeof LiftEmailBlockDialog>["lift"];
};

/**
 * Whether email reaches this person: the block in plain words with the one action that lifts
 * it, the address facts and the latest sends. The lift action is shown, disabled with its reason,
 * or left out, as the server decided for the signed-in viewer. An open email is in the page's
 * address (`?emailSend=`): it can be linked and reloaded, Back closes it, and J and K step through
 * the sends shown, newest first.
 */
export function EmailDeliveryView({ userId, personName, email, view, viewerCanLift, lift }: Props) {
  const vm = useMemo(
    () => buildEmailDeliveryPanelVm({ view, personName, viewerCanLift }),
    [view, personName, viewerCanLift],
  );
  // The dialog keeps the block it was opened for: the panel refreshes behind it after a lift.
  const [liftBlock, setLiftBlock] = useState<EmailBlockView | null>(null);
  const [showAll, setShowAll] = useState(false);
  const whyId = useId();
  const searchParams = useSearchParams();

  const block = vm.block;
  const rows = showAll ? vm.sends : vm.sends.slice(0, SENDS_COLLAPSED);
  const ids = useMemo(() => rows.map((send) => send.id), [rows]);
  const panel = useQueuePanel({
    param: EMAIL_SEND_PARAM,
    ids,
    initialId: searchParams?.get(EMAIL_SEND_PARAM) ?? null,
    noun: "email",
  });
  const openSend = vm.sends.find((send) => send.id === panel.openId) ?? null;

  const liftAction =
    block?.lift.kind === "enabled" ? (
      <StaffButton variant="secondary" onClick={() => setLiftBlock(view.block)}>
        Lift block…
      </StaffButton>
    ) : block?.lift.kind === "disabled" ? (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <StaffButton variant="secondary" disabled aria-describedby={whyId}>
          Lift block…
        </StaffButton>
        <span id={whyId} className="text-staff-xs text-staff-fg">
          {block.lift.reason}.
        </span>
      </div>
    ) : null;

  return (
    <Section
      id="email-delivery"
      title="Email delivery"
      description={email}
      className="scroll-mt-20"
      bodyClassName="p-0"
      action={<StatusBadge tone={vm.badge.tone}>{vm.badge.label}</StatusBadge>}
    >
      {block ? (
        <div className="px-4 pt-4">
          <Notice
            tone={block.tone}
            title={block.title}
            {...(liftAction ? { actions: liftAction } : {})}
          >
            <p>{block.body}</p>
            {block.detail ? (
              <p className="mt-1 text-staff-xs text-staff-fg">Details: {block.detail}</p>
            ) : null}
          </Notice>
        </div>
      ) : null}
      <div className="px-4 py-3">
        <KeyValueList
          items={vm.facts.map((fact) => ({
            label: fact.label,
            value: fact.sub ? (
              <span className="flex flex-col">
                <span>{fact.value}</span>
                <span className="text-staff-muted">{fact.sub}</span>
              </span>
            ) : (
              fact.value
            ),
          }))}
        />
      </div>
      <EmailSendsTable
        rows={rows}
        total={vm.sends.length}
        showingAll={showAll}
        onShowAll={() => setShowAll(true)}
        onOpen={panel.open}
        activeId={openSend ? openSend.id : null}
        personName={personName}
        skippedCount={vm.skippedCount}
      />
      <EmailSendDetail
        send={openSend}
        onOpenChange={panel.onOpenChange}
        {...(openSend && panel.queue ? { queue: panel.queue } : {})}
      />
      {liftBlock ? (
        <LiftEmailBlockDialog
          open
          onOpenChange={(next) => {
            if (!next) setLiftBlock(null);
          }}
          userId={userId}
          personName={personName}
          email={email}
          block={liftBlock}
          skippedCount={vm.skippedCount}
          {...(lift ? { lift } : {})}
        />
      ) : null}
    </Section>
  );
}
