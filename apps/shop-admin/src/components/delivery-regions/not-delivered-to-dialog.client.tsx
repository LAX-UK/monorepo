"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { checkRestrictedCountries } from "@/lib/delivery-regions";
import type { saveNotDeliveredTo } from "@/server/application/delivery-regions-actions.server";
import type { AdminDeliveryRegions, DeliveryCountry } from "@auction/shop-contracts";
import { EntityMultiPicker, Field } from "@auction/staff-ui";
import { useState } from "react";

/**
 * Choose the countries LAX does not deliver to. One field, so a problem shows inline only, and
 * the list can be emptied. The UK is never offered.
 */
export function NotDeliveredToDialog({
  open,
  onOpenChange,
  current,
  choices,
  save,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: readonly DeliveryCountry[];
  choices: readonly DeliveryCountry[];
  save: typeof saveNotDeliveredTo;
  onSaved: (regions: AdminDeliveryRegions) => void;
}) {
  const action = useAdminAction();
  const [codes, setCodes] = useState<string[]>(() => current.map((country) => country.code));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const problem = checkRestrictedCountries(codes);
    setError(problem);
    if (problem) return;
    const ok = await action.run(
      async () => {
        const result = await save({ countries: codes, idempotencyKey: action.idempotencyKey });
        if (result.ok) onSaved(result.data);
        return result;
      },
      "Countries not delivered to saved",
      "change delivery regions",
    );
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={(next) => {
          if (next) setCodes(current.map((country) => country.code));
          setError(null);
          onOpenChange(next);
        }}
        title="Countries not delivered to"
        description="Buyers in these countries are not offered delivery, and are pointed to collection."
        submitLabel="Save countries"
        pending={action.pending}
        onSubmit={() => void submit()}
      >
        {action.error}
        <Field label="Countries" error={error ?? undefined}>
          <EntityMultiPicker
            value={codes}
            onValueChange={setCodes}
            options={choices.map((country) => ({ id: country.code, label: country.name }))}
            placeholder="Add a country"
            searchPlaceholder="Search countries"
            emptyText="No matching country."
          />
        </Field>
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}
