"use client";

import type { WizardDraftPayload } from "@/components/admin/admin-form-wizard/wizard-draft";
import { stepIndexForField } from "@/components/admin/artist-form/admin-artist-form.constants";
import {
  ARTIST_STEP_FIELD_GROUPS,
  artistSetupWizardValidationMessage,
} from "@/components/admin/artist-form/artist-setup-steps";
import { scenarioFromOwnerUserId } from "@/components/admin/artist-form/scenario-config";
import type { ArtistFormValues, ArtistScenario } from "@/components/admin/artist-form/types";
import { adminCreateArtistResultAction, adminUpdateArtistResultAction } from "@/lib/actions/admin";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { validateWizardStep } from "@/lib/forms/validate-wizard-step";
import { notify } from "@/lib/ui/notify";
import type { ArtistKind } from "@auction/types";
import { adminCreateArtistBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type UseAdminArtistFormArgs = {
  mode: "create" | "edit";
  artistId?: string | undefined;
  defaultValues: ArtistFormValues;
  readOnly?: boolean;
};

export function useAdminArtistForm({
  mode,
  artistId,
  defaultValues,
  readOnly = false,
}: UseAdminArtistFormArgs) {
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

  return {
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
    mode,
    readOnly,
  };
}
