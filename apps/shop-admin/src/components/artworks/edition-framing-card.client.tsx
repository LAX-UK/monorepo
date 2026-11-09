"use client";

import { FrameSwatch } from "@/components/framing/frame-swatch";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type EditionFramingFormValues,
  FRAMING_MODE_CHOICES,
  UNREADABLE_SHEET_SIZE,
  editionFramingFormValues,
  isEditionFramingDirty,
  optionUnavailableReason,
  sheetSizeProblem,
  shoppersWillSee,
  sizeBandSentence,
  validateEditionFramingForm,
} from "@/lib/edition-framing-form";
import { saveEditionFraming } from "@/server/application/framing-actions.server";
import { framingLeadTime } from "@/server/domain/framing-catalogue.vm";
import type { AdminEditionFraming, AdminEditionFramingOption } from "@auction/shop-contracts";
import { FRAMED_BY_ARTIST_MAX_LENGTH, type FramingMode } from "@auction/shop-domain";
import {
  ChoiceRow,
  Field,
  FormActions,
  FormErrorSummary,
  FormSection,
  MoneyInput,
  Notice,
  StaffButton,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  TextArea,
  formatStaffMoney,
  toast,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export type EditionFramingPermissions = {
  /** `catalogue.write`: choose how the edition is sold and which options it offers. */
  write: boolean;
  /** `artwork_price.write`: give an edition its own price for an option. */
  setPrice: boolean;
};

/**
 * The editor's Framing card: how this edition is sold with respect to framing (unframed with
 * framing to choose, framed only, or framed by the artist), which catalogue options it offers and
 * its own price for each, with a live "Shoppers will see". Saved on its own. An option waiting
 * for the framer's prices, or paused, is listed but cannot be switched on, and says why.
 */
export function EditionFramingCard({
  artworkId,
  title,
  framing,
  printPricePence,
  permissions,
}: {
  artworkId: string;
  title: string;
  framing: AdminEditionFraming;
  /** The edition's print price, shown beside "Unframed" in the preview. */
  printPricePence: number | null;
  permissions: EditionFramingPermissions;
}) {
  const router = useRouter();
  const base = useId();
  const id = (name: string) => `${base}-${name}`;
  const [saved, setSaved] = useState(framing);
  const [baseline, setBaseline] = useState(() => editionFramingFormValues(framing));
  const [values, setValues] = useState<EditionFramingFormValues>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const readOnly = !permissions.write;
  const dirty = isEditionFramingDirty(values, baseline);
  const preview = shoppersWillSee(saved, values, printPricePence);
  const byArtist = values.mode === "framed_by_artist";
  const sizeProblem = sheetSizeProblem(saved);

  function change(next: EditionFramingFormValues) {
    setValues(next);
    // After a first attempt, the form is rechecked as it changes.
    if (attempts > 0) {
      const checked = validateEditionFramingForm(next, saved);
      setErrors(checked.ok ? {} : checked.errors);
    }
  }

  function setOffer(
    optionId: string,
    patch: Partial<{ offered: boolean; overridePence: number | null }>,
  ) {
    const current = values.offers[optionId] ?? { offered: false, overridePence: null };
    change({ ...values, offers: { ...values.offers, [optionId]: { ...current, ...patch } } });
  }

  async function submit() {
    setFormError(null);
    const checked = validateEditionFramingForm(values, saved);
    setAttempts((count) => count + 1);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    const result = await saveEditionFraming({
      artworkId,
      body: checked.body,
      idempotencyKey,
    }).catch(() => ({ ok: false, kind: "failed", message: "Save failed. Try again." }) as const);
    setSaving(false);
    if (!result.ok) {
      setFormError(
        result.kind === "conflict"
          ? "Someone else changed this edition's framing after you opened it. Reload the page to see their version."
          : adminMutationErrorMessage(result),
      );
      toast.error("The framing was not saved");
      return;
    }
    const next = editionFramingFormValues(result.data);
    setSaved(result.data);
    setBaseline(next);
    setValues(next);
    setAttempts(0);
    setIdempotencyKey(crypto.randomUUID());
    toast.success("Framing saved");
    router.refresh();
  }

  const summary = [
    ...(errors.offers ? [{ fieldId: id("modes"), message: errors.offers }] : []),
    ...(errors.framedByArtist ? [{ fieldId: id("artist"), message: errors.framedByArtist }] : []),
    ...saved.options.flatMap((option) => {
      const message = errors[`option:${option.optionId}`];
      return message ? [{ fieldId: id(`offer-${option.optionId}`), message }] : [];
    }),
  ];

  return (
    <form
      noValidate
      aria-label={`Framing for ${title}`}
      className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormSection title="Framing" description={sizeBandSentence(saved)}>
        <FormErrorSummary errors={summary} focusKey={attempts} />
        {formError ? <Notice tone="danger" alert title={formError} /> : null}
        {readOnly ? (
          <Notice tone="info" title="View only">
            You can see how this edition is sold but not change it.
          </Notice>
        ) : null}
        {sizeProblem && !byArtist ? (
          <Notice
            tone={sizeProblem === "unreadable" ? "warning" : "info"}
            title={sizeProblem === "unreadable" ? "Sheet size not read" : "No size band yet"}
          >
            {sizeProblem === "unreadable"
              ? UNREADABLE_SHEET_SIZE
              : sizeProblem === "too_large"
                ? "Framing is quoted for sheets larger than 80 × 100 cm, so no options can be offered."
                : "Add the sheet size, for example 50 × 70 cm, on the Edition card to offer framing options."}
          </Notice>
        ) : null}

        <fieldset className="flex flex-col gap-1" disabled={readOnly}>
          <legend className="mb-1 text-staff-sm font-medium text-staff-fg">How it is sold</legend>
          <StaffRadioGroup
            id={id("modes")}
            value={values.mode}
            onValueChange={(mode) => change({ ...values, mode: mode as FramingMode })}
            aria-label="How it is sold"
          >
            {FRAMING_MODE_CHOICES.map((choice) => (
              <ChoiceRow
                key={choice.value}
                htmlFor={id(`mode-${choice.value}`)}
                label={choice.label}
                description={choice.description}
                control={
                  <StaffRadio
                    id={id(`mode-${choice.value}`)}
                    value={choice.value}
                    disabled={readOnly}
                  />
                }
              />
            ))}
          </StaffRadioGroup>
        </fieldset>

        {byArtist ? (
          <Field
            label="The artist's frame"
            id={id("artist")}
            description={`In a sentence, for example "Oak frame made by the artist". Up to ${FRAMED_BY_ARTIST_MAX_LENGTH} characters.`}
            error={errors.framedByArtist}
          >
            <TextArea
              rows={3}
              maxLength={FRAMED_BY_ARTIST_MAX_LENGTH * 2}
              value={values.framedByArtist}
              disabled={readOnly}
              onChange={(event) => change({ ...values, framedByArtist: event.target.value })}
            />
          </Field>
        ) : (
          <OptionsTable
            options={saved.options}
            values={values}
            permissions={permissions}
            readOnly={readOnly}
            errors={errors}
            idFor={(optionId) => id(`offer-${optionId}`)}
            onOffer={(optionId, offered) => setOffer(optionId, { offered })}
            onPrice={(optionId, pence) => setOffer(optionId, { overridePence: pence })}
          />
        )}

        <div className="flex flex-col gap-1 rounded-staff-md border border-staff-line-subtle bg-staff-sunken p-3">
          <p className="text-staff-sm font-medium text-staff-fg">Shoppers will see</p>
          {preview.length > 0 ? (
            <ul className="flex flex-col gap-0.5 text-staff-sm text-staff-muted">
              {preview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-staff-sm text-staff-muted">
              No framing. The edition page looks as it does today.
            </p>
          )}
          {saved.options.some(
            (option) => values.offers[option.optionId]?.offered && !option.offerable,
          ) ? (
            <p className="text-staff-xs text-staff-muted">
              Options that are paused in the catalogue, or waiting for prices, are not shown.
            </p>
          ) : null}
        </div>
      </FormSection>
      {readOnly ? null : (
        <FormActions className="border-t border-staff-line-subtle pt-4">
          <StaffButton
            type="button"
            variant="secondary"
            disabled={!dirty || saving}
            onClick={() => {
              setValues(baseline);
              setErrors({});
              setAttempts(0);
              setFormError(null);
            }}
          >
            Discard changes
          </StaffButton>
          <StaffButton type="submit" variant="primary" loading={saving} disabled={!dirty}>
            {dirty ? "Save framing" : "Saved"}
          </StaffButton>
        </FormActions>
      )}
    </form>
  );
}

function OptionsTable({
  options,
  values,
  permissions,
  readOnly,
  errors,
  idFor,
  onOffer,
  onPrice,
}: {
  options: readonly AdminEditionFramingOption[];
  values: EditionFramingFormValues;
  permissions: EditionFramingPermissions;
  readOnly: boolean;
  errors: Record<string, string>;
  idFor: (optionId: string) => string;
  onOffer: (optionId: string, offered: boolean) => void;
  onPrice: (optionId: string, pence: number | null) => void;
}) {
  if (options.length === 0) {
    return (
      <Notice tone="info" title="No framing options in the catalogue yet">
        Add options under Shop › Framing, then choose which ones this edition offers.
      </Notice>
    );
  }
  return (
    <div className="overflow-x-auto rounded-staff-md border border-staff-line">
      <table className="w-full min-w-[34rem] text-left text-staff-sm">
        <caption className="sr-only">Framing options this edition can offer</caption>
        <thead className="bg-staff-sunken text-staff-xs text-staff-muted">
          <tr>
            <th scope="col" className="w-20 px-3 py-2 font-medium">
              Offered
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Option
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Catalogue
            </th>
            <th scope="col" className="w-44 px-3 py-2 font-medium">
              Price for this edition
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Lead time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-staff-line-subtle">
          {options.map((option) => {
            const offer = values.offers[option.optionId];
            const offered = offer?.offered ?? false;
            const blocked = optionUnavailableReason(option);
            // An option already offered can always be switched off; a blocked one cannot be switched on.
            const cannotToggle = readOnly || (blocked !== null && !offered);
            const error = errors[`option:${option.optionId}`];
            return (
              <tr key={option.optionId} className={blocked && !offered ? "text-staff-muted" : ""}>
                <td className="px-3 py-3 align-top">
                  <StaffCheckbox
                    id={idFor(option.optionId)}
                    aria-label={`Offer ${option.name}`}
                    checked={offered}
                    disabled={cannotToggle}
                    onCheckedChange={(checked) => onOffer(option.optionId, checked === true)}
                  />
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="font-medium">
                    <FrameSwatch frame={option.frame} />
                    {option.name}
                  </span>
                  {blocked ? (
                    <span className="block text-staff-xs text-staff-muted">{blocked}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right align-top tabular-nums">
                  {option.cataloguePricePence === null
                    ? "—"
                    : formatStaffMoney(option.cataloguePricePence)}
                </td>
                <td className="px-3 py-3 align-top">
                  {offered && permissions.setPrice && !readOnly ? (
                    <Field
                      label={`Price for this edition: ${option.name}`}
                      labelHidden
                      optional
                      error={error}
                    >
                      <MoneyInput
                        value={offer?.overridePence ?? null}
                        placeholder={
                          option.cataloguePricePence === null
                            ? "0.00"
                            : (option.cataloguePricePence / 100).toFixed(2)
                        }
                        onValueChange={(pence) => onPrice(option.optionId, pence)}
                      />
                    </Field>
                  ) : (
                    <span className="text-staff-muted">
                      {offered && offer?.overridePence != null
                        ? `${formatStaffMoney(offer.overridePence)} (edition price)`
                        : "Catalogue price"}
                    </span>
                  )}
                  {error && !(offered && permissions.setPrice && !readOnly) ? (
                    <span className="block text-staff-xs text-staff-danger">{error}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top tabular-nums">{framingLeadTime(option)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
