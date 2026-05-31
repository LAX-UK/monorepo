"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { ArtistPreview } from "@/components/admin/artist-form/artist-preview";
import {
  ARTIST_SETUP_STEPS,
  ARTIST_STEP_FIELD_GROUPS,
  artistSetupStepLabel,
  artistSetupWizardValidationMessage,
} from "@/components/admin/artist-form/artist-setup-steps";
import { KindSelector } from "@/components/admin/artist-form/kind-selector";
import { ArtistScenarioBadge } from "@/components/admin/artist-form/scenario-badge";
import { scenarioFromOwnerUserId } from "@/components/admin/artist-form/scenario-config";
import { AttributesSection } from "@/components/admin/artist-form/sections/attributes-section";
import { BiographySection } from "@/components/admin/artist-form/sections/biography-section";
import { CategoriesSection } from "@/components/admin/artist-form/sections/categories-section";
import { FlagsSection } from "@/components/admin/artist-form/sections/flags-section";
import { IdentitySection } from "@/components/admin/artist-form/sections/identity-section";
import { LifespanSection } from "@/components/admin/artist-form/sections/lifespan-section";
import { MediaSection } from "@/components/admin/artist-form/sections/media-section";
import { UserLinkSection } from "@/components/admin/artist-form/sections/user-link-section";
import type { ArtistFormValues, ArtistScenario } from "@/components/admin/artist-form/types";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import { CatalogFormSection as ArtistFormSection } from "@/components/admin/forms/catalog-form-section";
import { RhfSelect } from "@/components/ui/rhf-select";
import { LabelCaps } from "@/components/ui/typography";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { notify } from "@/lib/ui/notify";
import {
  type ArtistKind,
  type ArtistStatus,
  type CategoryNode,
  getCreatorKindConfig,
} from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { adminCreateArtistBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

const ARTIST_STATUS_OPTIONS: ReadonlyArray<{ value: ArtistStatus; label: string }> = [
  { value: "approved", label: "Approved (visible to public)" },
  { value: "pending", label: "Pending review" },
  { value: "rejected", label: "Rejected (hidden)" },
];

type Props = {
  mode: "create" | "edit";
  artistId?: string;
  /** Read-only slug for edit display (not part of form values). */
  slug?: string;
  defaultValues: ArtistFormValues;
  /** Collecting categories (departments) for the multiselect. */
  categories?: CategoryNode[];
  /** From URL `?scenario=historical` or `maker-seller` */
  initialScenario?: ArtistScenario | null;
  /** When true all fields are disabled (e.g. merged artist) */
  readOnly?: boolean;
  /** DOM id on the root `<form>` for external submit triggers (e.g. mobile action bar). */
  htmlFormId?: string;
};

/** Map a form field error key (e.g. "attributes.movement") to its wizard step index. */
function stepIndexForField(field: string): number {
  const head = field.split(".")[0] ?? field;
  const idx = ARTIST_STEP_FIELD_GROUPS.findIndex((group) => group.some((f) => String(f) === head));
  return idx >= 0 ? idx : ARTIST_SETUP_STEPS.length - 1;
}

export function AdminArtistForm({
  mode,
  artistId,
  slug,
  defaultValues,
  categories = [],
  initialScenario: _initialScenario = null,
  readOnly = false,
  htmlFormId,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [validationStepIndex, setValidationStepIndex] = useState<number | null>(null);
  const wizardGoToRef = useRef<(index: number) => void>(() => {});
  const baselineRef = useRef(defaultValues);
  baselineRef.current = defaultValues;

  const form = useForm<ArtistFormValues>({
    resolver: zodResolver(adminCreateArtistBodySchema),
    defaultValues,
  });

  const getValuesRef = useRef(form.getValues);
  getValuesRef.current = form.getValues;

  const watchedDisplay = useWatch({ control: form.control, name: "displayName" }) ?? "";
  const watchedKind =
    (useWatch({ control: form.control, name: "kind" }) as ArtistKind | undefined) ?? "artist";
  const watchedShortBio = useWatch({ control: form.control, name: "shortBio" }) ?? "";
  const watchedPortrait = useWatch({ control: form.control, name: "portraitUrl" }) ?? "";
  const watchedOwnerUserId =
    (useWatch({ control: form.control, name: "ownerUserId" }) as string | null | undefined) ?? null;

  const activeScenario: ArtistScenario = useMemo(() => {
    if (mode === "edit") return scenarioFromOwnerUserId(watchedOwnerUserId);
    if (watchedOwnerUserId) return "maker-seller";
    return watchedKind === "maker" ? "maker-seller" : "historical";
  }, [mode, watchedKind, watchedOwnerUserId]);
  const kindConfig = getCreatorKindConfig(watchedKind);

  const clearBanner = useCallback(() => {
    setValidationBanner(null);
    setValidationStepIndex(null);
  }, []);

  const handleBeforeNext = useCallback(
    async (stepIndex: number) => {
      if (readOnly) return true;
      const fields = ARTIST_STEP_FIELD_GROUPS[stepIndex];
      if (
        fields?.length &&
        !(await validateWizardStep(form, adminCreateArtistBodySchema, fields))
      ) {
        setValidationStepIndex(stepIndex);
        setValidationBanner(artistSetupWizardValidationMessage(stepIndex));
        return false;
      }
      clearBanner();
      return true;
    },
    [clearBanner, form, readOnly],
  );

  const submit = form.handleSubmit(async (values) => {
    clearBanner();
    if (mode === "create" && activeScenario === "maker-seller" && !values.ownerUserId) {
      setValidationStepIndex(1);
      setValidationBanner("Link a platform user for a maker–seller profile.");
      wizardGoToRef.current(1);
      notify.error("Link a platform user for a maker–seller profile.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result =
        mode === "create"
          ? await adminCreateArtistResultAction(values)
          : artistId
            ? await adminUpdateArtistResultAction(artistId, values)
            : { ok: false as const, error: "Missing artist" };
      if (result.ok) {
        form.reset(values);
        notify.success(mode === "create" ? "Artist created" : "Artist saved");
        if (mode === "edit" && artistId) {
          router.push(`/admin/artists/${artistId}`);
        } else if (mode === "create" && result.data?.id) {
          router.push(`/admin/artists/${result.data.id}?created=1`);
        } else {
          router.push("/admin/artists");
        }
        return;
      }
      if (result.fieldErrors) {
        applyActionFieldErrors(form, result.fieldErrors);
        const firstStep = Math.min(...Object.keys(result.fieldErrors).map(stepIndexForField));
        setValidationStepIndex(firstStep);
        setValidationBanner(artistSetupWizardValidationMessage(firstStep));
        wizardGoToRef.current(firstStep);
        return;
      }
      setValidationBanner(result.error);
      notify.error(result.error);
    } finally {
      setIsSubmitting(false);
    }
  });

  const draftExtras =
    mode === "create"
      ? {
          draft: {
            entityKind: "admin_artist_new",
            entityId: "new",
            getValues: () => getValuesRef.current() as Record<string, unknown>,
          },
          onDraftResume: (payload: WizardDraftPayload) => {
            form.reset({
              ...baselineRef.current,
              ...(payload.values as Partial<ArtistFormValues>),
            });
          },
        }
      : {};

  const submitSlot = (
    <LoadingButton
      type="submit"
      loading={isSubmitting}
      loadingLabel="Saving…"
      disabled={readOnly}
      data-wizard-submit="true"
      className="min-h-11 w-full sm:w-auto"
    >
      {mode === "create" ? "Create artist" : "Save artist"}
    </LoadingButton>
  );

  return (
    <>
      <FormDirtyGuard isDirty={form.formState.isDirty} />
      <Form {...form}>
        <form id={htmlFormId} className="space-y-8" onSubmit={submit}>
          {mode === "edit" ? <ArtistScenarioBadge scenario={activeScenario} /> : null}

          {validationBanner ? (
            <WizardValidationBanner
              message={validationBanner}
              {...(validationStepIndex != null
                ? {
                    stepLabel: artistSetupStepLabel(validationStepIndex),
                    onJumpToStep: () => wizardGoToRef.current(validationStepIndex),
                  }
                : {})}
            />
          ) : null}

          <AdminFormWizard
            steps={ARTIST_SETUP_STEPS}
            isDirty={form.formState.isDirty}
            pending={isSubmitting}
            hideStickyOnMobile
            showSubmitOnAllSteps={mode === "edit"}
            onStepControl={({ goTo }) => {
              wizardGoToRef.current = goTo;
            }}
            onBeforeNext={handleBeforeNext}
            onStepBack={clearBanner}
            submitSlot={submitSlot}
            leadingSlot={
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                className="min-h-11 w-full sm:w-auto"
                onClick={() => router.push("/admin/artists")}
              >
                Cancel
              </Button>
            }
            {...draftExtras}
          >
            {(stepIndex) => (
              <div className="mx-auto max-w-2xl">
                <div className="min-w-0 space-y-6">
                  {stepIndex === 0 ? (
                    <div className="space-y-3">
                      <div>
                        <h2 className="font-display text-lg font-semibold tracking-tight">
                          What kind of creator is this?
                        </h2>
                        <p className="text-sm text-on-surface-variant">
                          The form adapts its labels, lifespan fields, and attributes to the
                          selected kind.
                        </p>
                      </div>
                      <FormField
                        control={form.control}
                        name="kind"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <KindSelector
                                value={(field.value as ArtistKind | undefined) ?? "artist"}
                                onChange={(k) => field.onChange(k)}
                                onBlur={field.onBlur}
                                disabled={isSubmitting || readOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {stepIndex === 1 ? (
                    <>
                      {activeScenario === "maker-seller" ? (
                        <ArtistFormSection
                          title="Platform user"
                          description="Who this catalogue profile represents when they sell their own work."
                          defaultOpen
                        >
                          <UserLinkSection
                            control={form.control}
                            disabled={isSubmitting || readOnly}
                            emphasize
                          />
                        </ArtistFormSection>
                      ) : null}
                      <ArtistFormSection
                        title="Identity"
                        description={
                          mode === "edit"
                            ? "Public name and place. URL slug is set at creation."
                            : "Public name and place — a unique slug is generated when you save."
                        }
                        defaultOpen
                      >
                        <IdentitySection
                          control={form.control}
                          mode={mode}
                          {...(mode === "edit" && slug ? { slug } : {})}
                          disabled={isSubmitting || readOnly}
                        />
                      </ArtistFormSection>
                      <ArtistFormSection
                        title="Lifespan & origin"
                        description={
                          kindConfig.lifespanMode === "organisation"
                            ? "Founded / dissolved years and country of origin."
                            : "Birth / death years and country."
                        }
                        defaultOpen
                      >
                        <LifespanSection
                          control={form.control}
                          kind={watchedKind}
                          disabled={isSubmitting || readOnly}
                        />
                      </ArtistFormSection>
                    </>
                  ) : null}

                  {stepIndex === 2 ? (
                    <>
                      <ArtistFormSection
                        title="Biography"
                        description="Copy shown on the public artist profile."
                        defaultOpen
                      >
                        <BiographySection
                          control={form.control}
                          disabled={isSubmitting || readOnly}
                        />
                      </ArtistFormSection>
                      <ArtistFormSection
                        title="Media"
                        description="Portrait, hero, and website links."
                        defaultOpen
                      >
                        <MediaSection control={form.control} disabled={isSubmitting || readOnly} />
                      </ArtistFormSection>
                    </>
                  ) : null}

                  {stepIndex === 3 ? (
                    <>
                      <ArtistFormSection
                        title="Departments"
                        description="Collecting categories this creator belongs to."
                        defaultOpen
                      >
                        <CategoriesSection
                          control={form.control}
                          categories={categories}
                          disabled={isSubmitting || readOnly}
                        />
                      </ArtistFormSection>
                      <ArtistFormSection
                        title={`${kindConfig.label} attributes`}
                        description="Kind-specific details surfaced on the public profile."
                        defaultOpen
                      >
                        <AttributesSection
                          control={form.control}
                          kind={watchedKind}
                          disabled={isSubmitting || readOnly}
                        />
                      </ArtistFormSection>
                    </>
                  ) : null}

                  {stepIndex === 4 ? (
                    <>
                      <ArtistPreview
                        scenario={activeScenario}
                        data={{
                          displayName: String(watchedDisplay),
                          kindLabel: artistKindMeta(watchedKind).label,
                          shortBio: String(watchedShortBio ?? ""),
                          portraitUrl: String(watchedPortrait ?? ""),
                        }}
                      />
                      <ArtistFormSection
                        title="Catalogue status"
                        description="Controls public visibility of the profile."
                        defaultOpen
                      >
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <LabelCaps>Status</LabelCaps>
                              </FormLabel>
                              <RhfSelect
                                value={field.value ?? "approved"}
                                onValueChange={(v) => field.onChange(v as ArtistStatus)}
                                onBlur={field.onBlur}
                                disabled={isSubmitting || readOnly}
                                options={[...ARTIST_STATUS_OPTIONS]}
                                triggerClassName="min-h-11 w-full font-body text-sm"
                              />
                              <p className="text-xs text-on-surface-variant">
                                Approved profiles appear in the public directory. Pending hides the
                                profile and flags attached lots for review.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </ArtistFormSection>
                      <ArtistFormSection
                        title="Visibility"
                        description="Featured, verified, and archive flags."
                        defaultOpen
                      >
                        <FlagsSection control={form.control} disabled={isSubmitting || readOnly} />
                      </ArtistFormSection>
                      {activeScenario === "historical" ? (
                        <ArtistFormSection
                          title="Optional user link"
                          description="Rarely needed for external profiles; use the maker–seller path when the seller is the maker."
                          defaultOpen={false}
                        >
                          <UserLinkSection
                            control={form.control}
                            disabled={isSubmitting || readOnly}
                            emphasize={false}
                          />
                        </ArtistFormSection>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </AdminFormWizard>
        </form>
      </Form>
    </>
  );
}
