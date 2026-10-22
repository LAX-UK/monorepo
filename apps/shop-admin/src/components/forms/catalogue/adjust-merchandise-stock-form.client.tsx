"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
  requiredText,
} from "@/lib/form-validation";
import { adjustMerchandiseStock } from "@/server/application/admin-catalogue-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function AdjustMerchandiseStockForm() {
  const mutation = useAdminMutation();
  const [variantId, setVariantId] = useState("");
  const [onHand, setOnHand] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Adjust variant stock"
      mutation={mutation}
      errors={errors}
      submitLabel="Adjust stock"
      onSubmit={() => {
        const quantity = parseWholeNumber(onHand, { min: 0 }, "Enter the quantity on hand.");
        const next = collectFieldErrors({
          variantId: requiredText(variantId, "Enter the variant ID."),
          onHand: quantity.ok ? null : quantity.message,
        });
        setErrors(next);
        if (hasFieldErrors(next) || !quantity.ok) return;
        void mutation.run(
          () =>
            adjustMerchandiseStock({
              variantId: variantId.trim(),
              onHand: quantity.value,
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Stock adjusted",
        );
      }}
    >
      <TextField
        name="variantId"
        label="Variant ID"
        value={variantId}
        error={errors.variantId}
        disabled={mutation.pending}
        onChange={setVariantId}
      />
      <TextField
        name="onHand"
        label="On hand"
        type="number"
        min={0}
        value={onHand}
        error={errors.onHand}
        disabled={mutation.pending}
        onChange={setOnHand}
      />
    </AdminForm>
  );
}
