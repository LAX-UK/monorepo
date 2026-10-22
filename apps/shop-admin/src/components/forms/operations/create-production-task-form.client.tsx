"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { createProductionTask } from "@/server/application/admin-operations-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function CreateProductionTaskForm() {
  const mutation = useAdminMutation();
  const [orderLineId, setOrderLineId] = useState("");
  const [editionId, setEditionId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Create production task"
      mutation={mutation}
      errors={errors}
      submitLabel="Create task"
      onSubmit={() => {
        const next = collectFieldErrors({
          orderLineId: requiredText(orderLineId, "Enter the order line ID."),
          editionId: requiredText(editionId, "Enter the edition ID."),
        });
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () =>
            createProductionTask({
              orderLineId: orderLineId.trim(),
              editionId: editionId.trim(),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Production task created",
        );
      }}
    >
      <TextField
        name="orderLineId"
        label="Order line ID"
        value={orderLineId}
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
  );
}
