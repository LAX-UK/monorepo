"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  emptyProofListingForm,
  proofListingBody,
  validateProofListingForm,
  withProofType,
} from "@/lib/proof-listing-form";
import { createProofListing } from "@/server/application/edition-run-actions.server";
import type { AdminProofType } from "@auction/shop-contracts";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  MoneyInput,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
  parsePoundsToPence,
  toast,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

const FORM_ID = "create-proof-listing";

const TYPES: ReadonlyArray<{ value: AdminProofType; label: string }> = [
  { value: "ap", label: "Artist's proof" },
  { value: "pp", label: "Printer's proof" },
  { value: "hc", label: "Hors commerce" },
];

/**
 * "Create proof listing": a separate draft that sells some of the proofs the main run kept,
 * numbered "AP 1/3", with the main run's title, images and facts copied for staff to confirm.
 * Hors commerce proofs need a shop admin's approval.
 */
export function ProofListingDialog({
  open,
  onOpenChange,
  artworkId,
  title,
  available,
  permissions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  title: string;
  /** Proofs kept and not yet listed, by type. */
  available: Record<AdminProofType, number>;
  permissions: { setPrice: boolean; approveHorsCommerce: boolean };
}) {
  const router = useRouter();
  const [values, setValues] = useState(emptyProofListingForm);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const context = { canSetPrice: permissions.setPrice };
  const errors = attempted ? validateProofListingForm(values, available, context) : {};
  const typedPence = parsePoundsToPence(values.priceText);

  function reset(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(emptyProofListingForm());
      setAttempted(false);
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  async function submit() {
    if (Object.keys(validateProofListingForm(values, available, context)).length > 0) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await createProofListing({
      artworkId,
      body: proofListingBody(values, context),
      idempotencyKey,
    }).catch(
      () => ({ ok: false, kind: "failed", message: "Creating failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    toast.success("Proof listing created as a draft. Confirm its edition facts before publishing.");
    onOpenChange(false);
    router.push(`/artworks/${result.data.artworkId}`);
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={reset}
      size="md"
      title="Create proof listing"
      description={`A separate draft that sells some of the proofs kept from ${title}. It starts with the same title, images and facts.`}
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => reset(false)}>
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
            Create proof listing
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        <ChoiceFieldset legend="Proofs" id="proof-listing-type" error={errors.proofType}>
          <StaffRadioGroup
            value={values.proofType ?? ""}
            onValueChange={(next) =>
              setValues((current) => withProofType(current, next as AdminProofType, available))
            }
          >
            {TYPES.map((type) => {
              const left = available[type.value];
              const needsAdmin = type.value === "hc" && !permissions.approveHorsCommerce;
              const blocked = left === 0 || needsAdmin;
              const description =
                left === 0
                  ? "None kept on this run, or all already listed"
                  : needsAdmin
                    ? "Needs a shop admin's approval"
                    : `${left} kept and not yet listed`;
              return (
                <ChoiceRow
                  key={type.value}
                  htmlFor={`proof-type-${type.value}`}
                  control={
                    <StaffRadio
                      id={`proof-type-${type.value}`}
                      value={type.value}
                      disabled={blocked}
                    />
                  }
                  label={type.label}
                  description={description}
                  disabled={blocked}
                />
              );
            })}
          </StaffRadioGroup>
        </ChoiceFieldset>
        {values.proofType ? (
          <>
            <Field label="How many to list" error={errors.count} id="proof-listing-count">
              <TextInput
                inputMode="numeric"
                autoComplete="off"
                value={values.countText}
                boxClassName="sm:max-w-40"
                className="tabular-nums"
                onChange={(event) =>
                  setValues((current) => ({ ...current, countText: event.target.value }))
                }
              />
            </Field>
            <ChoiceFieldset legend="Owner" id="proof-listing-owner">
              <StaffRadioGroup
                value={values.owner}
                className="flex flex-wrap gap-x-5"
                onValueChange={(owner) =>
                  setValues((current) => ({
                    ...current,
                    owner: owner === "lax" ? "lax" : "artist",
                  }))
                }
              >
                <ChoiceRow
                  htmlFor="proof-owner-artist"
                  control={<StaffRadio id="proof-owner-artist" value="artist" />}
                  label="The artist"
                />
                <ChoiceRow
                  htmlFor="proof-owner-lax"
                  control={<StaffRadio id="proof-owner-lax" value="lax" />}
                  label="LAX"
                />
              </StaffRadioGroup>
            </ChoiceFieldset>
            {permissions.setPrice ? (
              <Field
                label="Price per proof"
                optional
                description="In pounds, including VAT. Leave blank until the price is agreed."
                error={errors.price}
                id="proof-listing-price"
              >
                <MoneyInput
                  value={typedPence.ok ? typedPence.pence : null}
                  onValueChange={() => undefined}
                  onInput={(event) =>
                    setValues((current) => ({ ...current, priceText: event.currentTarget.value }))
                  }
                  placeholder="0.00"
                  boxClassName="sm:max-w-60"
                />
              </Field>
            ) : null}
            {values.proofType === "hc" ? (
              <ChoiceFieldset legend="Approval" id="proof-listing-approval" error={errors.approval}>
                <ChoiceRow
                  htmlFor="proof-hc-approved"
                  control={
                    <StaffCheckbox
                      id="proof-hc-approved"
                      checked={values.horsCommerceApproved}
                      onCheckedChange={(checked) =>
                        setValues((current) => ({
                          ...current,
                          horsCommerceApproved: checked === true,
                        }))
                      }
                    />
                  }
                  label="I approve listing this hors commerce proof"
                  description="Its page says: Hors commerce proof, originally not for sale."
                />
              </ChoiceFieldset>
            ) : null}
          </>
        ) : null}
      </form>
    </StaffDialog>
  );
}
