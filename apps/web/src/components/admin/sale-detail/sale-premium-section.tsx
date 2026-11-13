"use client";

import { adminUseSalePremiumForLotsResultAction } from "@/lib/admin/catalog-lifecycle/admin-catalog-lifecycle-mutations";
import {
  type SalePremiumOverview,
  differingLotsTitle,
} from "@/lib/admin/sales/sale-premium-overview";
import { LOTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import { ConfirmActionDialog, KeyValueList, Notice, Section, StaffButton } from "@auction/staff-ui";
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
 * The sale's buyer's premium in words with a worked example, and a warning listing unsold lots
 * that charge their own premium, with one action to put them back on the sale's. The action
 * changes only lots whose bidding has not opened, is confirmed first and is recorded in the
 * audit log. People who may not edit lots see the list without the action.
 */
export function SalePremiumSection({ saleId, overview }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editable = overview.editableLotIds.length;
  const lockedCount = overview.differingLots.length - editable;

  const confirm = () => {
    setFailure(null);
    startTransition(async () => {
      // A refusal or a failed request keeps the dialog open with the reason; nothing changed.
      const result = await adminUseSalePremiumForLotsResultAction(
        saleId,
        overview.editableLotIds,
      ).catch(() => null);
      if (!result?.ok) {
        setFailure(result?.error || "The lots could not be changed. Try again.");
        return;
      }
      setOpen(false);
      notify.success(`${lotsWord(result.data?.updated ?? 0)} now use the sale's premium`);
      router.refresh();
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
          title={differingLotsTitle(overview.differingLots.length)}
          actions={
            editable > 0 ? (
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
                Use the sale&apos;s premium for these lots
              </StaffButton>
            ) : null
          }
        >
          <KeyValueList
            items={overview.differingLots.map((lot) => ({ label: lot.label, value: lot.premium }))}
          />
          {lockedCount > 0 ? (
            <p>
              {lotsWord(lockedCount)} {lockedCount === 1 ? "is" : "are"} open for bidding and keep
              {lockedCount === 1 ? "s" : ""} {lockedCount === 1 ? "its" : "their"} premium.
            </p>
          ) : null}
        </Notice>
      ) : null}
      <ConfirmActionDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={`Use the sale's premium for ${lotsWord(editable)}?`}
        description={
          <>
            {lotsWord(editable)} will charge {overview.terms} instead of{" "}
            {editable === 1 ? "its" : "their"} own premium. Sold lots and lots open for bidding are
            not changed. The change is recorded in the sale&apos;s activity.
          </>
        }
        confirmLabel={`Use the sale's premium for ${lotsWord(editable)}`}
        loading={pending}
        onConfirm={confirm}
      >
        {failure ? (
          <Notice tone="danger" title="The lots were not changed" alert>
            {failure}
          </Notice>
        ) : null}
      </ConfirmActionDialog>
    </Section>
  );
}
