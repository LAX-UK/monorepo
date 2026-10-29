"use client";

import {
  createSubmissionFromValuesAction,
  submitForReviewFromValuesAction,
  updateSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import { trackWizardSubmit } from "@/lib/analytics/sell-funnel";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { EMPTY_SUBMISSION_FORM_VALUES } from "@/lib/forms/submission/item-submission-form-defaults";
import { allWizardFieldPaths } from "@/lib/forms/submission/step-validation";
import { sanitizeSubmissionFormValues } from "@/lib/forms/submission/submission-form-data";
import type { SubmissionAccountScope } from "@/lib/services/interfaces/submission-service";
import { notify } from "@/lib/ui/notify";
import { evaluateSubmissionQuality } from "@auction/domain";
import { type ItemSubmissionFormValues, itemSubmissionFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type FieldPath, useForm, useFormState } from "react-hook-form";

export type WizardMode = { kind: "create" } | { kind: "edit"; submissionId: string };

export type SubmissionWizardControllerOptions = {
  /**
   * The account the work is sold as, read at the moment of each save. "Sell a work" asks
   * for it in its second step; without it writes use the account in use.
   */
  accountScope?: () => SubmissionAccountScope;
};

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type SubmissionWizardController = FormController<ItemSubmissionFormValues> & {
  saveDraft: (opts?: { leaveAfter?: boolean; skipRedirect?: boolean }) => Promise<boolean>;
  submitForReview: () => Promise<void>;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  mode: WizardMode;
  submissionId: string | null;
};

const AUTOSAVE_MS = 1500;

function applyFieldErrors(
  form: ReturnType<typeof useForm<ItemSubmissionFormValues>>,
  fieldErrors: Record<string, string[] | undefined> | undefined,
) {
  if (!fieldErrors) return;
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    if (msgs?.[0]) {
      form.setError(key as FieldPath<ItemSubmissionFormValues>, { message: msgs[0] });
    }
  }
}

export function useSubmissionWizardController(
  mode: WizardMode,
  initial?: ItemSubmissionFormValues,
  options: SubmissionWizardControllerOptions = {},
): SubmissionWizardController {
  const accountScopeRef = useRef(options.accountScope);
  accountScopeRef.current = options.accountScope;
  const scope = useCallback(() => accountScopeRef.current?.() ?? {}, []);
  const router = useRouter();
  const [submitInFlight, setSubmitInFlight] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(
    mode.kind === "edit" ? mode.submissionId : null,
  );
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef(false);

  const form = useForm<ItemSubmissionFormValues>({
    resolver: zodResolver(itemSubmissionFormSchema),
    defaultValues: initial ?? EMPTY_SUBMISSION_FORM_VALUES,
    mode: "onTouched",
    reValidateMode: "onChange",
  });
  const { isDirty, isSubmitting: formIsSubmitting } = useFormState({ control: form.control });

  const persistUpdate = useCallback(
    async (values: ItemSubmissionFormValues, id: string): Promise<boolean> => {
      const r = await updateSubmissionFromValuesAction(id, values, scope());
      if (r.ok) {
        setLastSavedAt(new Date());
        setAutosaveStatus("saved");
        form.reset(form.getValues(), { keepDirtyValues: false });
        return true;
      }
      applyFieldErrors(form, r.fieldErrors);
      setAutosaveStatus("error");
      notify.error(r.error);
      return false;
    },
    [form, scope],
  );

  const saveDraft = useCallback(
    async (opts?: { leaveAfter?: boolean; skipRedirect?: boolean }): Promise<boolean> => {
      const values = sanitizeSubmissionFormValues(form.getValues());
      const parsed = itemSubmissionFormSchema.safeParse(values);
      if (!parsed.success) {
        notify.error(parsed.error.issues[0]?.message ?? "Fix validation errors before saving");
        return false;
      }

      setAutosaveStatus("saving");
      saveInFlight.current = true;

      const id = submissionId ?? (mode.kind === "edit" ? mode.submissionId : null);
      if (id) {
        const ok = await persistUpdate(parsed.data, id);
        saveInFlight.current = false;
        if (ok && opts?.leaveAfter) {
          notify.success("Progress saved");
          router.push("/selling/consignments");
        }
        return ok;
      }

      const r = await createSubmissionFromValuesAction(parsed.data, scope());
      saveInFlight.current = false;
      if (!r.ok) {
        applyFieldErrors(form, r.fieldErrors);
        setAutosaveStatus("error");
        notify.error(r.error);
        return false;
      }

      notify.success("Progress saved");
      const newId = r.data?.id;
      if (!newId) {
        setAutosaveStatus("error");
        notify.error("Saved but response was incomplete");
        return false;
      }
      setSubmissionId(newId);
      setLastSavedAt(new Date());
      setAutosaveStatus("saved");
      form.reset(parsed.data);
      if (opts?.leaveAfter) {
        router.push("/selling/consignments");
      } else if (!opts?.skipRedirect) {
        router.replace(r.data?.redirectTo ?? `/selling/consignments/${newId}`);
      }
      return true;
    },
    [form, mode, persistUpdate, router, scope, submissionId],
  );

  const submitForReview = useCallback(async () => {
    const valid = await form.trigger(allWizardFieldPaths(), { shouldFocus: true });
    if (!valid) {
      notify.error("Complete required fields before submitting");
      return;
    }

    const values = sanitizeSubmissionFormValues(form.getValues());
    const quality = evaluateSubmissionQuality({
      title: values.title,
      images: values.images,
      description: values.description,
      provenance: values.provenance,
      categoryId: values.categoryIds[0] ?? "",
      categoryIds: values.categoryIds,
    });
    if (!quality.canSubmit) {
      notify.error("Complete title, category, and at least one photo before submitting");
      return;
    }

    const parsed = itemSubmissionFormSchema.safeParse(values);
    if (!parsed.success) {
      notify.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    if (submitInFlight || saveInFlight.current) return;

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    saveInFlight.current = true;
    setAutosaveStatus("saving");
    setSubmitInFlight(true);

    try {
      let id = submissionId ?? (mode.kind === "edit" ? mode.submissionId : null);

      if (!id) {
        const r = await createSubmissionFromValuesAction(parsed.data, scope());
        if (!r.ok) {
          applyFieldErrors(form, r.fieldErrors);
          setAutosaveStatus("error");
          notify.error(r.error);
          return;
        }
        id = r.data?.id ?? null;
        if (!id) {
          setAutosaveStatus("error");
          notify.error("Could not create submission");
          return;
        }
        setSubmissionId(id);
      } else {
        const updated = await updateSubmissionFromValuesAction(id, parsed.data, scope());
        if (!updated.ok) {
          applyFieldErrors(form, updated.fieldErrors);
          setAutosaveStatus("error");
          notify.error(updated.error);
          return;
        }
      }

      const submitted = await submitForReviewFromValuesAction(id, scope());
      if (!submitted.ok) {
        setAutosaveStatus("error");
        notify.error(submitted.error);
        return;
      }

      trackWizardSubmit(id);
      notify.success("Submitted for review");
      setAutosaveStatus("saved");
      setLastSavedAt(new Date());
      router.push(`/selling/consignments/${id}`);
      router.refresh();
    } finally {
      saveInFlight.current = false;
      setSubmitInFlight(false);
    }
  }, [form, mode, router, scope, submissionId, submitInFlight]);

  useEffect(() => {
    if (mode.kind !== "edit" && !submissionId) return;
    if (!isDirty || formIsSubmitting || saveInFlight.current) {
      if (!isDirty) {
        setAutosaveStatus((prev) => (prev === "dirty" ? "idle" : prev));
      }
      return;
    }

    setAutosaveStatus("dirty");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const id = submissionId ?? (mode.kind === "edit" ? mode.submissionId : null);
      if (!id || saveInFlight.current) return;
      void (async () => {
        saveInFlight.current = true;
        setAutosaveStatus("saving");
        const values = sanitizeSubmissionFormValues(form.getValues());
        const parsed = itemSubmissionFormSchema.safeParse(values);
        if (!parsed.success) {
          saveInFlight.current = false;
          setAutosaveStatus("dirty");
          return;
        }
        await persistUpdate(parsed.data, id);
        saveInFlight.current = false;
      })();
    }, AUTOSAVE_MS);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [form, formIsSubmitting, isDirty, mode, persistUpdate, submissionId]);

  const onSubmit = form.handleSubmit(() => saveDraft());

  return {
    form,
    onSubmit,
    isSubmitting: submitInFlight || formIsSubmitting,
    error: null,
    saveDraft,
    submitForReview,
    autosaveStatus,
    lastSavedAt,
    mode,
    submissionId,
  };
}
