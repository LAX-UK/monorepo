"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { cancelOrderAfterPossession } from "@/server/application/admin-operations-actions.server";
import { ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { SelectField, TextField } from "../fields";
import type { OrderLineOption } from "./order-line-option";

export function CancelOrderLineForm({
  orderLineOptions,
}: {
  orderLineOptions: OrderLineOption[];
}) {
  const mutation = useAdminMutation();
  const [orderLineId, setOrderLineId] = useState(orderLineOptions[0]?.orderLineId ?? "");
  const [editionId, setEditionId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const line = orderLineOptions.find((option) => option.orderLineId === orderLineId);

  return (
    <>
      <AdminForm
        title="Cancel after possession"
        mutation={mutation}
        errors={errors}
        submitLabel="Cancel line"
        onSubmit={() => {
          const next = collectFieldErrors({
            orderLineId: requiredText(orderLineId, "Choose the order line to cancel."),
            editionId: requiredText(editionId, "Enter the edition ID."),
          });
          setErrors(next);
          if (!hasFieldErrors(next)) setConfirming(true);
        }}
      >
        <SelectField
          name="orderLineId"
          label="Order line"
          value={orderLineId}
          options={orderLineOptions.map((option) => ({
            value: option.orderLineId,
            label: option.label,
          }))}
          error={errors.orderLineId}
          disabled={mutation.pending}
          onChange={setOrderLineId}
        />
        <TextField
          name="editionId"
          label="Edition ID"
          value={editionId}
          error={errors.editionId}
          disabled={mutation.pending}
          onChange={setEditionId}
        />
      </AdminForm>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Cancel ${line?.label ?? "order line"}`}
        body="The line is cancelled and its price is refunded to the customer. This cannot be undone."
        confirmLabel="Cancel line"
        loading={mutation.pending}
        onConfirm={async () => {
          await mutation.run(
            () =>
              cancelOrderAfterPossession({
                orderLineId: orderLineId.trim(),
                editionId: editionId.trim(),
                idempotencyKey: mutation.idempotencyKey,
              }),
            "Cancellation submitted",
          );
          setConfirming(false);
        }}
      />
    </>
  );
}
