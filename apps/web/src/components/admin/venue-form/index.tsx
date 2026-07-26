"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { useCatalogValidationBanner } from "@/components/admin/catalog/use-catalog-form-submit";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { useGuardedNavigation } from "@/components/admin/use-guarded-navigation";
import {
  adminCreateVenueResultAction,
  adminUpdateVenueResultAction,
} from "@/lib/actions/admin-venues";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { notify } from "@/lib/ui/notify";
import type { CreateVenueInput, UpdateVenueInput, Venue } from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { createVenueSchema, normalizeUkPostcode, updateVenueSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { VenueContactStep } from "./steps/contact-step";
import { VenueLocationStep } from "./steps/location-step";
import { VenueNotesStep } from "./steps/notes-step";
import { type AdminVenueFormValues, venueFormSchema } from "./venue-form-values";
import { VENUE_SETUP_STEPS, VENUE_STEP_FIELD_GROUPS } from "./venue-setup-steps";

export type { AdminVenueFormValues } from "./venue-form-values";

type Props = {
  mode: "create" | "edit";
  venue?: Venue;
  platformLegalEntityId?: string | null;
  /** Display name for current legalEntityId in edit mode (pre-resolved on server). */
  legalEntityDisplayName?: string | null;
  /** Pass from getDetail; disables legal entity picker when venue has active sales. */
  salesUsingCount?: number;
  cancelHref?: string;
  htmlFormId?: string;
  preventNavigateAfterSave?: boolean;
  afterSuccessfulSave?: (venueId?: string) => void;
  /** When true, shows read-only archived banner and disables form submission. */
  isArchived?: boolean;
  /** Full-page create/edit uses a right sidebar stepper; sheet flows keep horizontal chips. */
  wizardLayout?: "default" | "sidebar";
};

function valueOrEmpty(value: string | number | null | undefined): string {
  return value == null ? "" : String(value);
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function photosFromForm(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultValues(venue: Venue | undefined, platformLegalEntityId?: string | null) {
  return {
    legalEntityId: venue?.legalEntityId ?? platformLegalEntityId ?? "",
    name: venue?.name ?? "",
    addressLine1: venue?.addressLine1 ?? "",
    addressLine2: venue?.addressLine2 ?? "",
    city: venue?.city ?? "",
    county: venue?.county ?? "",
    postcode: venue?.postcode ?? "",
    country: venue?.country ?? "United Kingdom",
    mapUrl: venue?.mapUrl ?? "",
    latitude: valueOrEmpty(venue?.latitude),
    longitude: valueOrEmpty(venue?.longitude),
    contactPhone: venue?.contactPhone ?? "",
    contactEmail: venue?.contactEmail ?? "",
    website: venue?.website ?? "",
    photos: venue?.photos.join(", ") ?? "",
    capacity: valueOrEmpty(venue?.capacity),
    accessNotes: venue?.accessNotes ?? "",
    parkingNotes: venue?.parkingNotes ?? "",
    directionsNotes: venue?.directionsNotes ?? "",
  } satisfies AdminVenueFormValues;
}

function toCreateInput(values: AdminVenueFormValues): CreateVenueInput {
  return {
    legalEntityId: values.legalEntityId.trim(),
    name: values.name.trim(),
    addressLine1: values.addressLine1.trim(),
    addressLine2: nullableText(values.addressLine2),
    city: values.city.trim(),
    county: nullableText(values.county),
    postcode: normalizeUkPostcode(values.postcode),
    country: values.country.trim() || "United Kingdom",
    mapUrl: nullableText(values.mapUrl),
    latitude: nullableNumber(values.latitude),
    longitude: nullableNumber(values.longitude),
    contactPhone: nullableText(values.contactPhone),
    contactEmail: nullableText(values.contactEmail),
    website: nullableText(values.website),
    photos: photosFromForm(values.photos),
    capacity: nullableNumber(values.capacity),
    accessNotes: nullableText(values.accessNotes),
    parkingNotes: nullableText(values.parkingNotes),
    directionsNotes: nullableText(values.directionsNotes),
  };
}

function toUpdateInput(values: AdminVenueFormValues): UpdateVenueInput {
  return toCreateInput(values);
}

export function AdminVenueForm({
  mode,
  venue,
  platformLegalEntityId,
  legalEntityDisplayName,
  salesUsingCount = 0,
  cancelHref = "/admin/venues",
  htmlFormId = CATALOG_FORM_IDS.venue,
  preventNavigateAfterSave = false,
  afterSuccessfulSave,
  isArchived = false,
  wizardLayout = "default",
}: Props) {
  const router = useRouter();
  const { guardedPush } = useGuardedNavigation();
  const [pending, startTransition] = useTransition();
  const {
    validationBanner,
    validationStepIndex,
    setValidationFailure,
    clearValidationBanner,
    notifyValidationFailure,
  } = useCatalogValidationBanner();

  const form = useForm<AdminVenueFormValues>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: defaultValues(venue, platformLegalEntityId),
  });

  const wizardGoToRef = useRef<(index: number) => void>(() => {});

  const validateAllSteps = useCallback(async () => {
    for (let i = 0; i < VENUE_STEP_FIELD_GROUPS.length; i++) {
      const fields = VENUE_STEP_FIELD_GROUPS[i];
      if (!fields?.length) continue;
      const { validateWizardStep } = await import("@/lib/forms/validate-wizard-step");
      if (!(await validateWizardStep(form, venueFormSchema, [...fields]))) {
        wizardGoToRef.current(i);
        setValidationFailure("Complete this step before saving.", i);
        return false;
      }
    }
    return true;
  }, [form, setValidationFailure]);

  if (isArchived) {
    return (
      <Alert variant="default">
        <AlertDescription>
          This venue is archived and cannot be edited. Unarchive it first to make changes.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form
          id={htmlFormId}
          className="space-y-8"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              clearValidationBanner();
              if (!(await validateAllSteps())) {
                setValidationFailure("Complete each step before saving.");
                notifyValidationFailure({});
                return;
              }

              const result = await (async () => {
                if (mode === "create") {
                  const parsed = createVenueSchema.safeParse(toCreateInput(values));
                  if (!parsed.success) {
                    applyActionFieldErrors(
                      form,
                      Object.fromEntries(
                        parsed.error.issues.map((issue) => [
                          issue.path.length ? issue.path.join(".") : "root",
                          [issue.message],
                        ]),
                      ),
                      { stepFields: VENUE_STEP_FIELD_GROUPS, goTo: wizardGoToRef.current },
                    );
                    notify.error("Check the highlighted fields.");
                    return null;
                  }
                  return adminCreateVenueResultAction(parsed.data);
                }
                if (!venue) return { ok: false as const, error: "Missing venue" };
                const parsed = updateVenueSchema.safeParse(toUpdateInput(values));
                if (!parsed.success) {
                  applyActionFieldErrors(
                    form,
                    Object.fromEntries(
                      parsed.error.issues.map((issue) => [
                        issue.path.length ? issue.path.join(".") : "root",
                        [issue.message],
                      ]),
                    ),
                    { stepFields: VENUE_STEP_FIELD_GROUPS, goTo: wizardGoToRef.current },
                  );
                  notify.error("Check the highlighted fields.");
                  return null;
                }
                return adminUpdateVenueResultAction(venue.id, parsed.data);
              })();

              if (!result) return;
              if (result.ok) {
                notify.success(mode === "create" ? "Venue created" : "Venue saved");
                router.refresh();
                const newId = mode === "create" ? result.data?.id : undefined;
                if (!preventNavigateAfterSave && newId) {
                  router.push(`/admin/venues/${newId}?created=1`);
                } else if (!preventNavigateAfterSave) {
                  router.push(venue?.id ? `/admin/venues/${venue.id}` : "/admin/venues");
                }
                afterSuccessfulSave?.(newId);
                return;
              }
              if (result.fieldErrors) {
                applyActionFieldErrors(form, result.fieldErrors, {
                  stepFields: VENUE_STEP_FIELD_GROUPS,
                  goTo: wizardGoToRef.current,
                });
                setValidationFailure("Check the highlighted fields.");
                notifyValidationFailure({});
                return;
              }
              setValidationFailure(result.error);
              notify.error(result.error);
            });
          })}
        >
          {validationBanner ? (
            <WizardValidationBanner
              message={validationBanner}
              {...(validationStepIndex != null && VENUE_SETUP_STEPS[validationStepIndex]?.label
                ? {
                    stepLabel: VENUE_SETUP_STEPS[validationStepIndex].label,
                    onJumpToStep: () => wizardGoToRef.current(validationStepIndex),
                  }
                : {})}
            />
          ) : null}
          <AdminFormWizard
            className="space-y-6"
            steps={VENUE_SETUP_STEPS}
            isDirty={form.formState.isDirty}
            pending={pending}
            layout={wizardLayout}
            hideStickyOnMobile={wizardLayout === "sidebar" && Boolean(htmlFormId)}
            showSubmitOnAllSteps={wizardLayout === "sidebar" && mode === "edit"}
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onBeforeNext={async (stepIndex) => {
              const fields = VENUE_STEP_FIELD_GROUPS[stepIndex];
              if (!fields?.length) return true;
              const { validateWizardStep } = await import("@/lib/forms/validate-wizard-step");
              return validateWizardStep(form, venueFormSchema, [...fields]);
            }}
            leadingSlot={
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                className="min-h-11 w-full sm:w-auto"
                onClick={() => guardedPush(cancelHref)}
              >
                Cancel
              </Button>
            }
            submitSlot={
              <LoadingButton
                type="submit"
                loading={pending}
                loadingLabel="Saving…"
                className="min-h-11 w-full sm:min-w-40 sm:w-auto"
              >
                {mode === "create" ? "Create venue" : "Save changes"}
              </LoadingButton>
            }
          >
            {(stepIndex) => (
              <>
                {stepIndex === 0 ? (
                  <VenueLocationStep
                    form={form}
                    mode={mode}
                    slug={venue?.slug}
                    disableLegalEntityPicker={
                      isArchived || (mode === "edit" && salesUsingCount > 0)
                    }
                    legalEntityDisplayName={legalEntityDisplayName}
                  />
                ) : null}
                {stepIndex === 1 ? <VenueContactStep form={form} /> : null}
                {stepIndex === 2 ? <VenueNotesStep form={form} /> : null}
              </>
            )}
          </AdminFormWizard>
        </form>
      </Form>
    </>
  );
}
