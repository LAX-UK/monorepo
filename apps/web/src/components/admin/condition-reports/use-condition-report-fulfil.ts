"use client";

import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { adminFulfilConditionReportResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { useCallback, useState, useTransition } from "react";

export type FulfilField = "summary" | "details" | "file" | "responseNote";

export type FulfilValues = {
  summary: string;
  details: string;
  responseNote: string;
};

export type FulfilErrors = Partial<Record<FulfilField, string>>;

export const FULFIL_LIMITS = { summary: 5000, details: 10_000, responseNote: 2000 } as const;

/** At least one of the three published parts is needed; none may run past what the API stores. */
export function validateFulfil(values: FulfilValues, downloadUrl: string | null): FulfilErrors {
  const errors: FulfilErrors = {};
  if (!values.summary.trim() && !values.details.trim() && !downloadUrl) {
    errors.summary = "Add a summary, details or a file";
  } else if (values.summary.trim().length > FULFIL_LIMITS.summary) {
    errors.summary = "Keep the summary to 5,000 characters or fewer";
  }
  if (values.details.trim().length > FULFIL_LIMITS.details) {
    errors.details = "Keep the details to 10,000 characters or fewer";
  }
  if (values.responseNote.trim().length > FULFIL_LIMITS.responseNote) {
    errors.responseNote = "Keep the internal note to 2,000 characters or fewer";
  }
  return errors;
}

const EMPTY: FulfilValues = { summary: "", details: "", responseNote: "" };

/**
 * The fulfil form's state: what staff typed, the uploaded file, and the submit. Validates on
 * submit, then re-validates as each field changes, so an error clears the moment it is fixed.
 * Publishing is refused while the file is still uploading.
 */
export function useConditionReportFulfil({
  requestId,
  onFulfilled,
}: {
  requestId: string;
  onFulfilled: () => void;
}) {
  const { uploadFile } = useUploadObjectLifecycle();
  const [values, setValues] = useState<FulfilValues>(EMPTY);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    values.summary !== "" ||
    values.details !== "" ||
    values.responseNote !== "" ||
    downloadUrl !== null;

  const errors: FulfilErrors = {
    ...(submitCount > 0 ? validateFulfil(values, downloadUrl) : {}),
    ...(uploadError ? { file: uploadError } : {}),
  };

  const setValue = useCallback((field: keyof FulfilValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const attach = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        const uploaded = await uploadFile(file, "lot_document");
        setDownloadUrl(uploaded.publicUrl);
        setFileName(file.name);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "The file could not be uploaded");
      } finally {
        setUploading(false);
      }
    },
    [uploadFile],
  );

  const removeFile = useCallback(() => {
    setDownloadUrl(null);
    setFileName(null);
    setUploadError(null);
  }, []);

  const submit = useCallback(() => {
    setSubmitCount((count) => count + 1);
    setFailure(null);
    if (uploading) {
      setFailure("Wait for the file to finish uploading, then publish.");
      return;
    }
    if (Object.keys(validateFulfil(values, downloadUrl)).length > 0) return;
    startTransition(async () => {
      const result = await adminFulfilConditionReportResultAction(requestId, {
        ...values,
        downloadUrl: downloadUrl ?? "",
      });
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      notify.success("Condition report published");
      onFulfilled();
    });
  }, [uploading, values, downloadUrl, requestId, onFulfilled]);

  return {
    values,
    setValue,
    fileName,
    uploading,
    errors,
    submitCount,
    failure,
    pending,
    dirty,
    attach,
    removeFile,
    submit,
  };
}
