"use client";

import { adminUseSalePremiumForLotsResultAction } from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import {
  READ_ONLY_NEXT_STEP,
  type SalePremiumOverview,
  differingLotsTitle,
  moreLotsLabel,
  openLotsNote,
  salePremiumActionLabel,
} from "@/lib/admin/sales/sale-premium-overview";
import { LOTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  StatusBadge,
  TextLink,
  useStaffCan,
} from "@auction/staff-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  saleId: string;
  overview: SalePremiumOverview;
};

function lotsWord(count: number): string {
  return count === 1 ? "1 lot" : `${count} lots`;
}

/**
 * The sale's buyer's premium in words with a worked example, and a warning naming the first few
 * unsold lots that charge their own premium (the rest are a link to the lots tab, filtered to
 * them), with one action to put them back on the sale's. The action changes only lots whose
 * bidding has not opened, is confirmed first and is recorded in the audit log. People who may
 * not edit lots see the list and who to ask instead of the action.
 */
export function SalePremiumSection({ saleId, overview }: Props) {
  const router = useRouter();
  const canEditLots = useStaffCan(LOTS_ACCESS);
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = overview.editableLotIds.length;
  const openNote = openLotsNote(overview.openCount);

  const confirm = () => {
    setFailure(null);
    startTransition(async () => {
      // A refusal or a failed request keeps the dialog open with the reason; nothing changed.
      const result = await adminUseSalePremiumForLotsResultAction(
        saleId,
        overview.editableLotIds,
      ).catch(() => null);
      // Updates after an await are wrapped again so they land with `pending` ending: otherwise
      // "Try again" shows while the button is still busy, and a quick press is lost.
      startTransition(() => {
        if (!result?.ok) {
          setFailure(result?.error || "The request did not reach the server.");
          return;
        }
        setOpen(false);
        notify.success(`${lotsWord(result.data?.updated ?? 0)} now use the sale's premium`);
        router.refresh();
      });
    });
  };

  return (
    <Section
      title="Buyer's premium"
      description={
        overview.isStandard
          ? "The standard premium in the Conditions of Sale. Lots use it unless they have their own."
          : "This sale's own premium, not the standard one in the Conditions of Sale. Lots use it unless they have their own."
      }
    >
      <KeyValueList
        items={[
          { label: "Premium", value: overview.terms },
          { label: "Example", value: overview.example },
        ]}
      />
      {overview.differingLots.length > 0 ? (
        <Notice
          tone="warning"
          // The action sits in the notice's top-right slot, level with the title, however long
          // the list below it is.
          className="sm:items-start"
          title={differingLotsTitle(overview.differingLots.length)}
          actions={
            editable > 0 && canEditLots ? (
              <StaffButton
                type="button"
                size="sm"
                variant="secondary"
                requires={LOTS_ACCESS}
                onClick={() => {
                  setFailure(null);
                  setOpen(true);
                }}
              >
                {salePremiumActionLabel(editable)}
              </StaffButton>
            ) : null
          }
        >
          <ul className="mt-1 flex flex-col gap-1" aria-label="Lots with their own premium">
            {overview.shownLots.map((lot) => (
              <li key={lot.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <TextLink href={lot.href} Link={Link}>
                  {lot.label}
                </TextLink>
                <span>{lot.premium}</span>
                {lot.editable ? null : <StatusBadge tone="live">Open for bidding</StatusBadge>}
              </li>
            ))}
          </ul>
          {overview.more ? (
            <p className="mt-1">
              <TextLink href={overview.more.href} Link={Link}>
                {moreLotsLabel(overview.more.count)}
              </TextLink>
            </p>
          ) : null}
          {openNote ? <p className="mt-1">{openNote}</p> : null}
          {canEditLots ? null : <p className="mt-1">{READ_ONLY_NEXT_STEP}</p>}
        </Notice>
      ) : null}
      <ConfirmActionDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={failure ? "Lots not changed" : `Use the sale's premium for ${lotsWord(editable)}?`}
        description={
          failure ? (
            // Announced as it appears: the person pressed confirm and is waiting on the outcome.
            <span role="alert">
              {failure} None of the {lotsWord(editable)} changed, so you can try again.
            </span>
          ) : (
            <>
              {lotsWord(editable)} will charge {overview.terms} instead of{" "}
              {editable === 1 ? "its" : "their"} own premium. Sold lots and lots open for bidding
              are not changed. The change is recorded in the sale&apos;s activity.
            </>
          )
        }
        confirmLabel={failure ? "Try again" : salePremiumActionLabel(editable)}
        loading={pending}
        onConfirm={confirm}
      />
    </Section>
  );
}
