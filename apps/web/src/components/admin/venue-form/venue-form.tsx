"use client";

import {
  StaffTextAreaField,
  StaffTextField,
  staffFieldId,
} from "@/components/admin/forms/staff-form-fields";
import { useStaffForm } from "@/components/admin/forms/use-staff-form";
import {
  adminCreateVenueResultAction,
  adminUpdateVenueResultAction,
} from "@/lib/actions/admin-venues";
import { searchLegalEntityOptions } from "@/lib/admin/pickers/staff-entity-search";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import {
  EntityPicker,
  Field,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormSection,
  Notice,
  StaffButton,
  UnsavedChangesDialog,
} from "@auction/staff-ui";
import type { Venue } from "@auction/types";
import { normalizeUkPostcode } from "@auction/validators";
import Link from "next/link";
import { useState } from "react";
import { useController } from "react-hook-form";
import {
  type AdminVenueFormValues,
  VENUE_FIELD_ORDER,
  VENUE_FORM_ID,
  parseVenueForm,
  venueDefaultValues,
  venueResolver,
} from "./venue-form-values";

export type { AdminVenueFormValues } from "./venue-form-values";

type Props = {
  mode: "create" | "edit";
  venue?: Venue;
  platformLegalEntityId?: string | null;
  /** Name of the venue's current organisation (resolved on the server). */
  legalEntityDisplayName?: string | null;
  /** Sales using the venue; while there are any, its organisation cannot change. */
  salesUsingCount?: number;
  cancelHref?: string;
};

/**
 * Creating or editing a venue as one page of sections: organisation and name, address, contact,
 * location and visitor information. Each field is checked against the venue rules on submit and
 * again as it changes, what to fix is listed at the top, and leaving with changes asks first.
 */
export function AdminVenueForm({
  mode,
  venue,
  platformLegalEntityId,
  legalEntityDisplayName,
  salesUsingCount = 0,
  cancelHref = "/admin/venues",
}: Props) {
  const [saving, setSaving] = useState(false);
  const { form, guard, summary, submitCount, formError, setFormError, markSaved, leave } =
    useStaffForm<AdminVenueFormValues>({
      resolver: venueResolver,
      defaultValues: venueDefaultValues(venue, platformLegalEntityId),
      formId: VENUE_FORM_ID,
      fieldOrder: VENUE_FIELD_ORDER,
      ...(venue ? { label: venue.name } : {}),
    });
  const organisation = useController({ control: form.control, name: "legalEntityId" });
  const lockOrganisation = mode === "edit" && salesUsingCount > 0;
  const f = { control: form.control, formId: VENUE_FORM_ID } as const;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    const parsed = parseVenueForm(values);
    if (!parsed.ok) return;
    setSaving(true);
    try {
      const result =
        mode === "create"
          ? await adminCreateVenueResultAction(parsed.data)
          : venue
            ? await adminUpdateVenueResultAction(venue.id, parsed.data)
            : { ok: false as const, error: "This venue could not be found." };
      if (result.ok) {
        markSaved();
        notify.success(mode === "create" ? `${values.name} created` : "Changes saved");
        await leave(
          mode === "create" && result.data && "id" in result.data
            ? `/admin/venues/${(result.data as { id: string }).id}`
            : venue
              ? `/admin/venues/${venue.id}`
              : "/admin/venues",
        );
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        applyActionFieldErrors(form, result.fieldErrors, { focusField: false });
        return;
      }
      setFormError(result.error);
    } finally {
      setSaving(false);
    }
  });

  return (
    <>
      <form
        id={VENUE_FORM_ID}
        noValidate
        aria-label={mode === "create" ? "New venue" : "Edit venue"}
        className="flex flex-col gap-6"
        onSubmit={submit}
      >
        <FormErrorSummary errors={summary} focusKey={submitCount} />
        {formError ? (
          <Notice tone="danger" alert title="The venue was not saved">
            {formError}
          </Notice>
        ) : null}

        <FormSection
          title="Organisation and name"
          description="Who runs the venue, and what it is called when choosing it for a sale."
        >
          <Field
            id={staffFieldId(VENUE_FORM_ID, "legalEntityId")}
            label="Organisation"
            description={
              lockOrganisation
                ? "Cannot be changed while sales use this venue."
                : "Only sales run by the same organisation can use the venue."
            }
            error={organisation.fieldState.error?.message}
            disabled={lockOrganisation}
          >
            <EntityPicker
              id={staffFieldId(VENUE_FORM_ID, "legalEntityId")}
              value={organisation.field.value || null}
              selected={
                organisation.field.value && legalEntityDisplayName
                  ? { id: organisation.field.value, label: legalEntityDisplayName }
                  : null
              }
              search={searchLegalEntityOptions}
              placeholder="Choose an organisation"
              searchPlaceholder="Search organisations"
              emptyText="No organisations match."
              disabled={lockOrganisation}
              onValueChange={(option) => organisation.field.onChange(option?.id ?? "")}
            />
          </Field>
          <StaffTextField {...f} name="name" label="Venue name" placeholder="e.g. Main gallery" />
          {mode === "edit" && venue?.slug ? (
            <Field
              label="Web address"
              description="Set when the venue was created. Cannot be changed."
            >
              <p className="font-mono text-staff-sm text-staff-fg">/{venue.slug}</p>
            </Field>
          ) : null}
        </FormSection>

        <FormSection title="Address" description="Where visitors and couriers go.">
          <StaffTextField {...f} name="addressLine1" label="Address line 1" />
          <StaffTextField {...f} name="addressLine2" label="Address line 2" optional />
          <FieldRow>
            <StaffTextField {...f} name="city" label="City" />
            <StaffTextField {...f} name="county" label="County" optional />
          </FieldRow>
          <FieldRow>
            <StaffTextField
              {...f}
              name="postcode"
              label="Postcode"
              tidyOnBlur={normalizeUkPostcode}
            />
            <StaffTextField {...f} name="country" label="Country" />
          </FieldRow>
        </FormSection>

        <FormSection title="Contact" description="How people reach the venue.">
          <FieldRow>
            <StaffTextField {...f} name="contactPhone" label="Phone" optional inputMode="tel" />
            <StaffTextField
              {...f}
              name="contactEmail"
              label="Email"
              optional
              inputMode="email"
              placeholder="name@example.com"
            />
          </FieldRow>
          <StaffTextField {...f} name="website" label="Website" optional placeholder="https://" />
        </FormSection>

        <FormSection
          title="Location"
          description="A map link and coordinates help visitors find the venue."
        >
          <StaffTextField
            {...f}
            name="mapUrl"
            label="Map link"
            optional
            placeholder="https://maps.google.com/…"
          />
          <FieldRow>
            <StaffTextField
              {...f}
              name="latitude"
              label="Latitude"
              optional
              inputMode="decimal"
              placeholder="51.5074"
            />
            <StaffTextField
              {...f}
              name="longitude"
              label="Longitude"
              optional
              inputMode="decimal"
              placeholder="-0.1278"
            />
          </FieldRow>
          <StaffTextField
            {...f}
            name="capacity"
            label="Capacity"
            description="How many people the room holds."
            optional
            inputMode="numeric"
            placeholder="250"
          />
        </FormSection>

        <FormSection
          title="Visitor information"
          description="Shown to people attending a sale at this venue."
        >
          <StaffTextAreaField
            {...f}
            name="accessNotes"
            label="Access"
            optional
            rows={3}
            placeholder="Door codes, step-free access…"
          />
          <StaffTextAreaField
            {...f}
            name="parkingNotes"
            label="Parking"
            optional
            rows={3}
            placeholder="Nearby car parks, restrictions…"
          />
          <StaffTextAreaField
            {...f}
            name="directionsNotes"
            label="Directions"
            optional
            rows={3}
            placeholder="From the station, nearest tube…"
          />
          <StaffTextAreaField
            {...f}
            name="photos"
            label="Photo links"
            description="One web address per line."
            optional
            rows={3}
            placeholder="https://example.com/photo-1.jpg"
          />
        </FormSection>

        <FormActions sticky>
          <StaffButton asChild variant="secondary">
            <Link href={cancelHref}>Cancel</Link>
          </StaffButton>
          <StaffButton type="submit" variant="primary" loading={saving}>
            {mode === "create" ? "Create venue" : "Save changes"}
          </StaffButton>
        </FormActions>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
