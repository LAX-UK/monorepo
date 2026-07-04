"use client";

import { AdminFormWizard } from "@/components/admin/admin-form-wizard";
import { WizardValidationBanner } from "@/components/admin/admin-form-wizard/wizard-validation-banner";
import { AdminArtistWizardSteps } from "@/components/admin/artist-form/admin-artist-wizard-steps";
import {
  ARTIST_SETUP_STEPS,
  artistSetupStepLabel,
} from "@/components/admin/artist-form/artist-setup-steps";
import { ArtistScenarioBadge } from "@/components/admin/artist-form/scenario-badge";
import type { ArtistFormValues, ArtistScenario } from "@/components/admin/artist-form/types";
import { useAdminArtistForm } from "@/components/admin/artist-form/use-admin-artist-form";
import { FormDirtyGuard } from "@/components/admin/form-dirty-guard";
import type { CategoryNode } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { useRouter } from "next/navigation";

type Props = {
  mode: "create" | "edit";
  artistId?: string;
  slug?: string;
  defaultValues: ArtistFormValues;
  categories?: CategoryNode[];
  initialScenario?: ArtistScenario | null;
  readOnly?: boolean;
  htmlFormId?: string;
};

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
  const {
    form,
    submit,
    isSubmitting,
    validationBanner,
    validationStepIndex,
    wizardGoToRef,
    activeScenario,
    watchedDisplay,
    watchedKind,
    watchedShortBio,
    watchedPortrait,
    clearBanner,
    handleBeforeNext,
    draftExtras,
  } = useAdminArtistForm({ mode, artistId, defaultValues, readOnly });

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
              <AdminArtistWizardSteps
                stepIndex={stepIndex}
                control={form.control}
                mode={mode}
                {...(slug ? { slug } : {})}
                categories={categories}
                activeScenario={activeScenario}
                watchedKind={watchedKind}
                watchedDisplay={watchedDisplay}
                watchedShortBio={watchedShortBio}
                watchedPortrait={watchedPortrait}
                isSubmitting={isSubmitting}
                readOnly={readOnly}
              />
            )}
          </AdminFormWizard>
        </form>
      </Form>
    </>
  );
}
