"use client";

import { ASIDE_CARD } from "@/components/dashboard/seller/consignment-detail-parts";
import { withdrawConsignmentAction } from "@/lib/actions/consignment-after-sale";
import type { ConditionsSection } from "@/lib/legal/conditions-of-business-part-c";
import type { ConsignmentWithdrawalViewModel } from "@/lib/seller/consignment-withdrawal-view";
import { notify } from "@/lib/ui/notify";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { Button } from "@auction/ui/lax";
import { Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  submissionId: string;
  view: ConsignmentWithdrawalViewModel;
  /** Part C, clause 28 of the Conditions of Business, shown before the seller confirms. */
  terms: ConditionsSection;
};

function WithdrawalTerms({ lead, terms }: { lead: string; terms: ConditionsSection }) {
  return (
    <div className="space-y-3 pt-1 text-left">
      <p className="font-body text-sm text-on-surface">{lead}</p>
      <p className="font-body text-sm font-semibold text-on-surface">{terms.title}</p>
      {terms.paragraphs.map((paragraph) => (
        <p key={paragraph} className="font-body text-sm leading-relaxed text-on-surface-variant">
          {paragraph}
        </p>
      ))}
      <p className="font-body text-xs text-on-surface-variant">
        From Part C of the{" "}
        <Link href="/terms#withdrawal-by-seller" className="text-link underline underline-offset-4">
          Conditions of Business
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Taking a consignment back: withdraw it before it is catalogued, or ask staff once it is. The
 * withdrawal conditions are shown before confirming; people who may not act are told who can.
 */
export function ConsignmentWithdrawPanel({ submissionId, view, terms }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (view.mode === "hidden") return null;

  if (view.mode === "requested") {
    return (
      <div className={`${ASIDE_CARD} space-y-2`} data-testid="withdrawal-requested">
        <h2 className="font-headline text-base font-semibold tracking-tight text-on-surface">
          Withdrawal requested
        </h2>
        <p className="flex items-start gap-2 font-body text-sm text-on-surface">
          <Clock className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
          <span>{view.message}</span>
        </p>
      </div>
    );
  }

  const confirm = () => {
    startTransition(async () => {
      const result = await withdrawConsignmentAction(submissionId);
      setOpen(false);
      if (result.ok) {
        notify.success(view.copy.done);
        router.refresh();
        return;
      }
      notify.error(result.error);
    });
  };

  return (
    <section aria-labelledby="withdraw-heading">
      <div className={`${ASIDE_CARD} space-y-4`} data-testid="withdrawal">
        <div className="space-y-1">
          <h2
            id="withdraw-heading"
            className="font-headline text-base font-semibold tracking-tight text-on-surface"
          >
            {view.copy.title}
          </h2>
          <p className="font-body text-sm text-on-surface-variant">{view.copy.body}</p>
        </div>
        {view.declined ? (
          <p className="font-body text-sm text-on-surface">{view.declined}</p>
        ) : null}
        {view.blockedReason ? (
          <p className="font-body text-sm text-on-surface-variant">{view.blockedReason}</p>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
            {view.copy.action}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={view.copy.confirmTitle}
        body={<WithdrawalTerms lead={view.copy.confirmLead} terms={terms} />}
        confirmLabel={view.copy.confirmLabel}
        cancelLabel="Keep it"
        tone="warning"
        loading={pending}
        onConfirm={confirm}
      />
    </section>
  );
}
