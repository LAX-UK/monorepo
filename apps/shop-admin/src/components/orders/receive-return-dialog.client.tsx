"use client";

import { useAdminAction } from "@/components/use-admin-action.client";
import { receiveReturn } from "@/server/application/admin-operations-actions.server";
import {
  DEFAULT_RECEIVE_DISPOSITION,
  RECEIVE_CHOICES,
  type ReturnRowView,
} from "@/server/domain/order-returns.vm";
import type { ShopReturnDisposition } from "@auction/shop-domain";
import {
  ChoiceRow,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
} from "@auction/staff-ui";
import { useId, useState } from "react";

/**
 * What to do with a print that has come back. Back on sale is chosen to begin with, since most
 * come back in good order; a damaged print is withdrawn instead. The button names the choice,
 * so the decision is read again just before it is made.
 */
export function ReceiveReturnDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ReturnRowView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = useAdminAction();
  const groupId = useId();
  const [disposition, setDisposition] = useState<ShopReturnDisposition>(
    DEFAULT_RECEIVE_DISPOSITION,
  );
  const choice = RECEIVE_CHOICES.find((candidate) => candidate.value === disposition);
  const formId = `${groupId}-form`;

  const submit = async () => {
    const ok = await action.run(
      () =>
        receiveReturn({
          returnId: row.returnId,
          disposition,
          idempotencyKey: action.idempotencyKey,
        }),
      disposition === "back_on_sale"
        ? "Return received, back on sale"
        : "Return received, withdrawn",
    );
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <StaffDialog
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        title={`Receive ${row.item}`}
        description="Check the print when it arrives. What you choose now sets whether it can be bought again."
        footer={
          <>
            <StaffButton
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={action.pending}
            >
              Cancel
            </StaffButton>
            <StaffButton variant="primary" type="submit" form={formId} loading={action.pending}>
              {choice?.confirmLabel ?? "Receive"}
            </StaffButton>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {action.error}
          <StaffRadioGroup
            aria-label="What happens to the print"
            value={disposition}
            onValueChange={(value) => setDisposition(value as ShopReturnDisposition)}
          >
            {RECEIVE_CHOICES.map((option) => {
              const id = `${groupId}-${option.value}`;
              return (
                <ChoiceRow
                  key={option.value}
                  htmlFor={id}
                  control={<StaffRadio id={id} value={option.value} disabled={action.pending} />}
                  label={option.label}
                  description={option.description}
                  disabled={action.pending}
                />
              );
            })}
          </StaffRadioGroup>
        </form>
      </StaffDialog>
    </>
  );
}
