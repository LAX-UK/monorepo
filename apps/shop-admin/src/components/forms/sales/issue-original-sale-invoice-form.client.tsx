"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { issueOriginalSaleInvoice } from "@/server/application/admin-sales-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function IssueOriginalSaleInvoiceForm() {
  const mutation = useAdminMutation();
  const [originalSaleId, setOriginalSaleId] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Issue Stripe invoice (step 2)"
      mutation={mutation}
      errors={errors}
      submitLabel="Issue invoice"
      footnote={
        <p className="text-sm text-on-surface-variant">
          After the buyer pays, Stripe sends <code>invoice.paid</code> to shop-api to assign the
          original and buyer editions automatically.
        </p>
      }
      onSubmit={() => {
        const next = collectFieldErrors({
          originalSaleId: requiredText(originalSaleId, "Enter the original sale ID."),
          buyerEmail: requiredText(buyerEmail, "Enter the buyer's email address."),
        });
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () =>
            issueOriginalSaleInvoice({
              originalSaleId: originalSaleId.trim(),
              buyerEmail: buyerEmail.trim(),
              ...(buyerName.trim() ? { buyerName: buyerName.trim() } : {}),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Invoice issued",
        );
      }}
    >
      <TextField
        name="originalSaleId"
        label="Original sale ID"
        value={originalSaleId}
        error={errors.originalSaleId}
        disabled={mutation.pending}
        onChange={setOriginalSaleId}
      />
      <TextField
        name="buyerEmail"
        label="Buyer email"
        type="email"
        value={buyerEmail}
        error={errors.buyerEmail}
        disabled={mutation.pending}
        onChange={setBuyerEmail}
      />
      <TextField
        name="buyerName"
        label="Buyer name (optional)"
        value={buyerName}
        disabled={mutation.pending}
        onChange={setBuyerName}
      />
    </AdminForm>
  );
}
