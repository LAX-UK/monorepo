"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import { formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
} from "@/lib/form-validation";
import { requestOrderRefund } from "@/server/application/admin-operations-actions.server";
import { ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { SelectField, TextField } from "../fields";
import type { OrderLineOption } from "./order-line-option";

const WHOLE_ORDER = "";

export function RefundOrderForm({
  orderId,
  orderLineOptions,
}: {
  orderId: string;
  orderLineOptions: OrderLineOption[];
}) {
  const mutation = useAdminMutation();
  const [amountPence, setAmountPence] = useState("");
  const [orderLineId, setOrderLineId] = useState(WHOLE_ORDER);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);

  const amount = parseWholeNumber(amountPence, { min: 1 }, "Enter a refund amount of at least 1p.");
  const line = orderLineOptions.find((option) => option.orderLineId === orderLineId);
  const formattedAmount = amount.ok ? formatAdminDetailGbpPence(amount.value) : "";

  return (
    <>
      <AdminForm
        title="Request refund"
        mutation={mutation}
        errors={errors}
        submitLabel="Request refund"
        onSubmit={() => {
          const next = collectFieldErrors({ amountPence: amount.ok ? null : amount.message });
          setErrors(next);
          if (!hasFieldErrors(next)) setConfirming(true);
        }}
      >
        <TextField
          name="amountPence"
          label="Amount (pence)"
          type="number"
          min={1}
          value={amountPence}
          error={errors.amountPence}
          disabled={mutation.pending}
          onChange={setAmountPence}
        />
        <SelectField
          name="orderLineId"
          label="Order line (optional)"
          value={orderLineId}
          options={[
            { value: WHOLE_ORDER, label: "Whole order" },
            ...orderLineOptions.map((option) => ({
              value: option.orderLineId,
              label: option.label,
            })),
          ]}
          disabled={mutation.pending}
          onChange={setOrderLineId}
        />
      </AdminForm>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Refund order ${orderId.slice(0, 8)}`}
        body={`This asks the payment provider to return ${formattedAmount} to the customer for ${
          line ? line.label : "the whole order"
        }. A refund cannot be undone once the provider has processed it.`}
        confirmLabel={`Refund ${formattedAmount}`}
        loading={mutation.pending}
        onConfirm={async () => {
          if (!amount.ok) return;
          await mutation.run(
            () =>
              requestOrderRefund({
                orderId,
                amountPence: amount.value,
                ...(orderLineId ? { orderLineId } : {}),
                idempotencyKey: mutation.idempotencyKey,
              }),
            "Refund requested",
          );
          setConfirming(false);
        }}
      />
    </>
  );
}
