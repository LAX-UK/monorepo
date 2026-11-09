"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type PrintApartValues,
  emptyPrintApartForm,
  printApartBody,
  printApartErrorSummary,
  printApartFieldId,
  printApartPreview,
  signatureNeedsMedium,
  signatureNeedsPlace,
  validatePrintApartForm,
} from "@/lib/print-apart-form";
import { setPrintApart } from "@/server/application/edition-run-actions.server";
import type { AdminEditionFacts, AdminRunPrint } from "@auction/shop-contracts";
import {
  CONDITION_LABELS,
  CONDITION_NOTES,
  MEDIUM_LABELS,
  PLACE_LABELS,
  REMARQUE_MEDIA,
  REMARQUE_PLACES,
  type SetApartPrint,
  describeSetApartBlock,
} from "@auction/shop-domain";
import {
  ChoiceFieldset,
  ChoiceRow,
  EnumSelect,
  Field,
  FormErrorSummary,
  MoneyInput,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  formatStaffTime,
  parsePoundsToPence,
  toast,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

const FORM_ID = "set-print-apart";

const SIGNATURE_KINDS = [
  { value: "hand_signed", label: "Signed by hand by the artist" },
  { value: "plate_signed", label: "Signature printed in the plate" },
  { value: "estate_stamped", label: "Estate stamp" },
  { value: "estate_signed", label: "Signed by the artist's estate" },
  { value: "unsigned", label: "Not signed" },
] as const;
const SIGNATURE_MEDIA = [
  { value: "pencil", label: "Pencil" },
  { value: "ink", label: "Ink" },
] as const;
const SIGNATURE_PLACES = [
  { value: "front_lower_margin", label: "Front, lower margin" },
  { value: "back", label: "Back" },
] as const;

const REMARQUE_MEDIUM_OPTIONS = REMARQUE_MEDIA.map((value) => ({
  value,
  label: MEDIUM_LABELS[value],
}));
const REMARQUE_PLACE_OPTIONS = REMARQUE_PLACES.map((value) => ({
  value,
  label: PLACE_LABELS[value],
}));
const CONDITION_OPTIONS = CONDITION_NOTES.map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

/** Fields that belong to the option above them, indented under it. */
function Nested({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-6.5 flex flex-col gap-3 border-l border-staff-line pl-4">{children}</div>
  );
}

/**
 * "Set print 3 apart": sell one print that differs from the rest on its own, with its own price.
 * It leaves the run's queue, so a buyer of the run never receives it by chance. A print that
 * cannot be set apart now (in a basket, held, withdrawn, not for sale) shows why instead of the
 * form. The wording shoppers will read is previewed from the choices as they are made.
 */
export function SetPrintApartDialog({
  open,
  onOpenChange,
  artworkId,
  runTitle,
  runLine,
  runPrice,
  runSignature,
  print,
  identity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The run the print belongs to. */
  artworkId: string;
  runTitle: string;
  /** "Limited edition of 30". */
  runLine: string;
  /** The price the run sells at, as text ("£180"), or null while it has none. */
  runPrice: string | null;
  runSignature: AdminEditionFacts["signature"];
  print: AdminRunPrint;
  identity: SetApartPrint;
}) {
  const router = useRouter();
  const [values, setValues] = useState(emptyPrintApartForm);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const run = { signature: runSignature };
  const errors = failedSubmits > 0 ? validatePrintApartForm(values, run) : {};
  const typedPence = parsePoundsToPence(values.priceText);
  const preview = printApartPreview(values, identity);
  const hasChoice = preview.rows.length > 0;
  const block = print.block
    ? describeSetApartBlock(
        { kind: print.block.kind, until: print.block.until ? new Date(print.block.until) : null },
        print.label,
        (until) => formatStaffTime(until, { zoneLabel: true }),
      )
    : null;

  function update(patch: Partial<PrintApartValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function reset(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(emptyPrintApartForm());
      setFailedSubmits(0);
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  async function submit() {
    if (Object.keys(validatePrintApartForm(values, run)).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await setPrintApart({
      artworkId,
      editionId: print.editionId,
      body: printApartBody(values),
      idempotencyKey,
    }).catch(
      () =>
        ({ ok: false, kind: "failed", message: "Setting it apart failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    toast.success(`Print ${print.label} is now listed on its own`);
    onOpenChange(false);
    router.push(`/artworks/${result.data.artworkId}`);
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={reset}
      size="md"
      title={`Set print ${print.label} apart`}
      description={
        block
          ? `${runTitle} · ${runLine}`
          : `${runTitle} · ${runLine}. It leaves the run's queue and is sold on its own.`
      }
      footer={
        <>
          <StaffButton variant="secondary" disabled={saving} onClick={() => reset(false)}>
            {block ? "Close" : "Cancel"}
          </StaffButton>
          {block ? (
            <StaffButton
              variant="primary"
              disabled
              title={`Print ${print.label} cannot be set apart now`}
            >
              Set apart
            </StaffButton>
          ) : (
            <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
              Set apart and create listing
            </StaffButton>
          )}
        </>
      }
    >
      {block ? (
        <Notice tone="warning" title={block.title}>
          {block.detail}
        </Notice>
      ) : (
        <form
          id={FORM_ID}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormErrorSummary
            errors={failedSubmits > 0 ? printApartErrorSummary(errors) : []}
            focusKey={failedSubmits}
          />
          {formError ? <Notice tone="danger" alert title={formError} /> : null}
          <ChoiceFieldset
            legend="What is different about this print"
            id={printApartFieldId("difference")}
            error={errors.difference}
          >
            <ChoiceRow
              htmlFor="print-apart-remarque"
              control={
                <StaffCheckbox
                  id="print-apart-remarque"
                  checked={values.remarque}
                  onCheckedChange={(checked) => update({ remarque: checked === true })}
                />
              }
              label="Remarque"
              description="An original drawing added by the artist"
            />
            {values.remarque ? (
              <Nested>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Drawn in"
                    error={errors.remarqueMedium}
                    id={printApartFieldId("remarqueMedium")}
                  >
                    <EnumSelect
                      value={values.remarqueMedium || null}
                      options={REMARQUE_MEDIUM_OPTIONS}
                      onValueChange={(remarqueMedium) => update({ remarqueMedium })}
                    />
                  </Field>
                  <Field
                    label="Place"
                    error={errors.remarquePlace}
                    id={printApartFieldId("remarquePlace")}
                  >
                    <EnumSelect
                      value={values.remarquePlace || null}
                      options={REMARQUE_PLACE_OPTIONS}
                      onValueChange={(remarquePlace) => update({ remarquePlace })}
                    />
                  </Field>
                </div>
              </Nested>
            ) : null}
            <ChoiceRow
              htmlFor="print-apart-dedicated"
              control={
                <StaffCheckbox
                  id="print-apart-dedicated"
                  checked={values.dedicated}
                  onCheckedChange={(checked) => update({ dedicated: checked === true })}
                />
              }
              label="Dedication"
              description="Inscribed to a named person. Shoppers are not told the name."
            />
            <ChoiceRow
              htmlFor="print-apart-signed"
              control={
                <StaffCheckbox
                  id="print-apart-signed"
                  checked={values.signedDifferently}
                  onCheckedChange={(checked) => update({ signedDifferently: checked === true })}
                />
              }
              label="Signed differently from the run"
            />
            {values.signedDifferently ? (
              <Nested>
                <Field
                  label="Signature"
                  error={errors.signatureKind}
                  id={printApartFieldId("signatureKind")}
                >
                  <EnumSelect
                    value={values.signatureKind || null}
                    options={SIGNATURE_KINDS}
                    onValueChange={(signatureKind) =>
                      update({ signatureKind, signatureMedium: "", signaturePlace: "" })
                    }
                  />
                </Field>
                {signatureNeedsMedium(values.signatureKind) ||
                signatureNeedsPlace(values.signatureKind) ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {signatureNeedsMedium(values.signatureKind) ? (
                      <Field
                        label="Signed in"
                        error={errors.signatureMedium}
                        id={printApartFieldId("signatureMedium")}
                      >
                        <EnumSelect
                          value={values.signatureMedium || null}
                          options={SIGNATURE_MEDIA}
                          onValueChange={(signatureMedium) => update({ signatureMedium })}
                        />
                      </Field>
                    ) : null}
                    <Field
                      label="Place"
                      error={errors.signaturePlace}
                      id={printApartFieldId("signaturePlace")}
                    >
                      <EnumSelect
                        value={values.signaturePlace || null}
                        options={SIGNATURE_PLACES}
                        onValueChange={(signaturePlace) => update({ signaturePlace })}
                      />
                    </Field>
                  </div>
                ) : null}
              </Nested>
            ) : null}
            <ChoiceRow
              htmlFor="print-apart-condition"
              control={
                <StaffCheckbox
                  id="print-apart-condition"
                  checked={values.condition}
                  onCheckedChange={(checked) => update({ condition: checked === true })}
                />
              }
              label="Condition note"
            />
            {values.condition ? (
              <Nested>
                <Field
                  label="Note"
                  error={errors.conditionNote}
                  id={printApartFieldId("conditionNote")}
                >
                  <EnumSelect
                    value={values.conditionNote || null}
                    options={CONDITION_OPTIONS}
                    onValueChange={(conditionNote) => update({ conditionNote })}
                  />
                </Field>
              </Nested>
            ) : null}
          </ChoiceFieldset>
          <Field
            label="Price"
            description={
              runPrice
                ? `In pounds, including VAT. The run sells at ${runPrice}. A remarque usually sells higher.`
                : "In pounds, including VAT. A remarque usually sells higher."
            }
            error={errors.price}
            id={printApartFieldId("price")}
          >
            <MoneyInput
              value={typedPence.ok ? typedPence.pence : null}
              onValueChange={() => undefined}
              onInput={(event) => update({ priceText: event.currentTarget.value })}
              placeholder="0.00"
              boxClassName="sm:max-w-60"
            />
          </Field>
          <section
            aria-label="Shoppers will see"
            className="flex flex-col gap-1.5 rounded-staff-md bg-staff-sunken px-3.5 py-3 text-staff-sm"
          >
            <p className="text-staff-xs text-staff-muted">Shoppers will see</p>
            <p className="font-medium text-staff-fg">{preview.eyebrow}</p>
            {hasChoice ? (
              <>
                {preview.rows.map((row) => (
                  <p key={row} className="text-staff-fg">
                    {row}
                  </p>
                ))}
                <p className="text-staff-fg">Basket: {preview.basket}</p>
              </>
            ) : (
              <p className="text-staff-muted">Choose what is different to see the wording.</p>
            )}
          </section>
        </form>
      )}
    </StaffDialog>
  );
}
