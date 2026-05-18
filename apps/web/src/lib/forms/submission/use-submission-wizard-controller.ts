"use client";

import {
  createSubmissionFromValuesAction,
  submitForReviewFromValuesAction,
  updateSubmissionFromValuesAction,
} from "@/lib/actions/submissions";
import type { FormController } from "@/lib/forms/shared/form-controller";
import { EMPTY_SUBMISSION_FORM_VALUES } from "@/lib/forms/submission/item-submission-form-defaults";
import { allWizardFieldPaths } from "@/lib/forms/submission/step-validation";
import { sanitizeSubmissionFormValues } from "@/lib/forms/submission/submission-form-data";
import { notify } from "@/lib/ui/notify";
import { type ItemSubmissionFormValues, itemSubmissionFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { type FieldPath, useForm, useFormState } from "react-hook-form";

export type WizardMode = { kind: "create" } | { kind: "edit"; submissionId: string };

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type SubmissionWizardController = FormController<ItemSubmissionFormValues> & {
  saveDraft: (opts?: { leaveAfter?: boolean }) => Promise<boolean>;
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
): SubmissionWizardController {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
      const r = await updateSubmissionFromValuesAction(id, values);
      if (r.ok) {
        setLastSavedAt(new Date());
        setAutosaveStatus("saved");
        form.reset(values);
        return true;
      }
      applyFieldErrors(form, r.fieldErrors);
      setAutosaveStatus("error");
      notify.error(r.error);
      return false;
    },
    [form],
  );

  const saveDraft = useCallback(
    async (opts?: { leaveAfter?: boolean }): Promise<boolean> => {
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
          notify.success("Draft saved");
          router.push("/dashboard/submissions");
        }
        return ok;
      }

      const r = await createSubmissionFromValuesAction(parsed.data);
      saveInFlight.current = false;
      if (!r.ok) {
        applyFieldErrors(form, r.fieldErrors);
        setAutosaveStatus("error");
        notify.error(r.error);
        return false;
      }

      notify.success("Draft saved");
      const newId = r.data?.id;
      if (!newId) {
        setAutosaveStatus("error");
        notify.error("Draft saved but response was incomplete");
        return false;
      }
      setSubmissionId(newId);
      setLastSavedAt(new Date());
      setAutosaveStatus("saved");
      form.reset(parsed.data);
      if (opts?.leaveAfter) {
        router.push("/dashboard/submissions");
      } else {
        router.replace(r.data?.redirectTo ?? `/dashboard/submissions/${newId}`);
      }
      return true;
    },
    [form, mode, persistUpdate, router, submissionId],
  );

  const submitForReview = useCallback(async () => {
    const valid = await form.trigger(allWizardFieldPaths(), { shouldFocus: true });
    if (!valid) {
      notify.error("Complete required fields before submitting");
      return;
    }

    const values = sanitizeSubmissionFormValues(form.getValues());
    if (values.images.length < 1) {
      form.setError("images", {
        message: "Add at least one photo before submitting for review",
      });
      notify.error("Add at least one photo before submitting");
      return;
    }

    const parsed = itemSubmissionFormSchema.safeParse(values);
    if (!parsed.success) {
      notify.error(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    startTransition(async () => {
      setAutosaveStatus("saving");
      let id = submissionId ?? (mode.kind === "edit" ? mode.submissionId : null);

      if (!id) {
        const r = await createSubmissionFromValuesAction(parsed.data);
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
        const updated = await updateSubmissionFromValuesAction(id, parsed.data);
        if (!updated.ok) {
          applyFieldErrors(form, updated.fieldErrors);
          setAutosaveStatus("error");
          notify.error(updated.error);
          return;
        }
      }

      const submitted = await submitForReviewFromValuesAction(id);
      if (!submitted.ok) {
        setAutosaveStatus("error");
        notify.error(submitted.error);
        return;
      }

      notify.success("Submitted for review");
      setAutosaveStatus("saved");
      setLastSavedAt(new Date());
      router.push(`/dashboard/submissions/${id}`);
      router.refresh();
    });
  }, [form, mode, router, submissionId]);

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

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [form.formState.isDirty]);

  const onSubmit = form.handleSubmit(() => saveDraft());

  return {
    form,
    onSubmit,
    isSubmitting: pending || form.formState.isSubmitting,
    error: null,
    saveDraft,
    submitForReview,
    autosaveStatus,
    lastSavedAt,
    mode,
    submissionId,
  };
}
