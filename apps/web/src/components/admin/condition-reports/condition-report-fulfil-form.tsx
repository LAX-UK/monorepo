"use client";

import {
  type FulfilField,
  useConditionReportFulfil,
} from "@/components/admin/condition-reports/use-condition-report-fulfil";
import {
  Field,
  FileDropzone,
  FormActions,
  FormErrorSummary,
  Notice,
  StaffButton,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import { useEffect, useId } from "react";

const FILE_TYPES = "application/pdf,image/jpeg,image/png,image/webp";

const FIELD_ORDER: FulfilField[] = ["summary", "details", "file", "responseNote"];

/**
 * Fulfils a request: the summary, details and file are published on the lot page, and the
 * internal note stays with staff. Validates on submit and again as each field changes; what is
 * unsaved is reported through `onDirtyChange` so the panel asks before it closes.
 */
export function ConditionReportFulfilForm({
  requestId,
  onFulfilled,
  onDirtyChange,
}: {
  requestId: string;
  onFulfilled: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const form = useConditionReportFulfil({ requestId, onFulfilled });
  const base = useId();
  const ids: Record<FulfilField, string> = {
    summary: `${base}-summary`,
    details: `${base}-details`,
    file: `${base}-file`,
    responseNote: `${base}-note`,
  };
  const { dirty } = form;

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const summaryErrors = FIELD_ORDER.flatMap((field) => {
    const message = form.errors[field];
    return message ? [{ fieldId: ids[field], message }] : [];
  });

  return (
    <form
      noValidate
      aria-label="Fulfil request"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <FormErrorSummary errors={summaryErrors} focusKey={form.submitCount} />
      {form.failure ? (
        <Notice tone="danger" alert title="That did not go through">
          {form.failure}
        </Notice>
      ) : null}
      <Notice tone="info" title="Published on the lot page">
        Add at least a summary, details or a file. Buyers see them on the lot.
      </Notice>
      <Field label="Summary" optional id={ids.summary} error={form.errors.summary}>
        <TextInput
          value={form.values.summary}
          onChange={(event) => form.setValue("summary", event.target.value)}
        />
      </Field>
      <Field label="Details" optional id={ids.details} error={form.errors.details}>
        <TextArea
          rows={5}
          value={form.values.details}
          onChange={(event) => form.setValue("details", event.target.value)}
        />
      </Field>
      <Field label="Condition report file" optional id={ids.file} error={form.errors.file}>
        <FileDropzone
          accept={FILE_TYPES}
          disabled={form.uploading}
          label={form.uploading ? "Uploading…" : form.fileName ? "Replace file" : "Upload a file"}
          hint={form.fileName ? `${form.fileName} is ready` : "PDF, JPEG, PNG or WebP"}
          onFiles={(files) => {
            const [file] = files;
            if (file) void form.attach(file);
          }}
        />
        {form.fileName ? (
          <StaffButton variant="ghost" size="sm" onClick={form.removeFile}>
            Remove file
          </StaffButton>
        ) : null}
      </Field>
      <Field
        label="Internal note"
        optional
        id={ids.responseNote}
        description="Kept with the request. Not published."
        error={form.errors.responseNote}
      >
        <TextArea
          rows={3}
          value={form.values.responseNote}
          onChange={(event) => form.setValue("responseNote", event.target.value)}
        />
      </Field>
      <FormActions>
        <StaffButton type="submit" variant="primary" loading={form.pending}>
          Fulfil and publish
        </StaffButton>
      </FormActions>
    </form>
  );
}
