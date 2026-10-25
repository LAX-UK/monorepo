"use client";

import type { PressSaveResult } from "@/components/admin/sale-detail/tabs/use-press-mutations";
import {
  DateInput,
  EnumSelect,
  Field,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
  TextInput,
} from "@auction/staff-ui";
import type { SalePressMentionType } from "@auction/types";
import { useEffect, useRef, useState, useTransition } from "react";

export type PressFormState = {
  url: string;
  headline: string;
  outletName: string;
  /** `YYYY-MM-DD`, or empty. */
  publishedAt: string;
  excerpt: string;
  mentionType: SalePressMentionType | "";
};

export const EMPTY_PRESS_FORM: PressFormState = {
  url: "",
  headline: "",
  outletName: "",
  publishedAt: "",
  excerpt: "",
  mentionType: "",
};

export const MENTION_TYPE_OPTIONS: { value: SalePressMentionType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "interview", label: "Interview" },
  { value: "quote", label: "Quote" },
  { value: "roundup", label: "Roundup" },
];

const NO_TYPE = "none";
type MentionChoice = SalePressMentionType | typeof NO_TYPE;
const MENTION_CHOICES: { value: MentionChoice; label: string }[] = [
  { value: NO_TYPE, label: "Not specified" },
  ...MENTION_TYPE_OPTIONS,
];

const EXCERPT_MAX = 280;
const FORM_ID = "press-mention";

type Errors = Partial<Record<"url" | "headline" | "outletName" | "excerpt", string>>;

/** What is wrong with the form, field by field; empty when it can be saved. */
export function validatePressForm(form: PressFormState): Errors {
  const errors: Errors = {};
  const url = form.url.trim();
  if (!url) errors.url = "Enter the article's web address.";
  else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.url = "Enter an address that starts with https://.";
      }
    } catch {
      errors.url = "Enter a full web address, such as https://example.com/article.";
    }
  }
  if (!form.outletName.trim()) errors.outletName = "Enter the outlet that published it.";
  if (!form.headline.trim()) errors.headline = "Enter the article's headline.";
  if (form.excerpt.length > EXCERPT_MAX) {
    errors.excerpt = `Keep the excerpt to ${EXCERPT_MAX} characters or fewer.`;
  }
  return errors;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  /** The values to start from: empty for a new link, the link's own when editing. */
  initial: PressFormState;
  /** Saves the list; a failure is shown in the dialog and the dialog stays open. */
  onSubmit: (form: PressFormState) => Promise<PressSaveResult>;
};

/**
 * Adds or edits one press link. Checked on submit and again on every change after that; a failed
 * save stays here, with what was typed.
 */
export function PressMentionDialog({ open, onOpenChange, mode, initial, onSubmit }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState<PressFormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setForm(initial);
    setSubmitted(false);
    setFailure(null);
  }, [open, initial]);

  const errors = submitted ? validatePressForm(form) : {};
  const patch = (next: Partial<PressFormState>) => setForm((prev) => ({ ...prev, ...next }));

  const submit = () => {
    setSubmitted(true);
    setFailure(null);
    if (Object.keys(validatePressForm(form)).length > 0) return;
    startTransition(async () => {
      const result = await onSubmit(form);
      if (result.ok) onOpenChange(false);
      else setFailure(result.error);
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      title={mode === "add" ? "Add a press link" : "Edit press link"}
      description="The article's details as published. The preview image is read from the article."
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={busy}>
            {mode === "add" ? "Add link" : "Save changes"}
          </StaffButton>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        <Field label="Article address" error={errors.url} disabled={busy}>
          <TextInput
            type="url"
            inputMode="url"
            placeholder="https://"
            value={form.url}
            onChange={(event) => patch({ url: event.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outlet" error={errors.outletName} disabled={busy}>
            <TextInput
              value={form.outletName}
              maxLength={200}
              onChange={(event) => patch({ outletName: event.target.value })}
            />
          </Field>
          <Field label="Published on" optional disabled={busy}>
            <DateInput
              value={form.publishedAt || null}
              onValueChange={(day) => patch({ publishedAt: day ?? "" })}
            />
          </Field>
        </div>
        <Field label="Headline" error={errors.headline} disabled={busy}>
          <TextInput
            value={form.headline}
            maxLength={500}
            onChange={(event) => patch({ headline: event.target.value })}
          />
        </Field>
        <Field label="Mention type" optional disabled={busy}>
          <EnumSelect<MentionChoice>
            value={form.mentionType || NO_TYPE}
            options={MENTION_CHOICES}
            onValueChange={(value) => patch({ mentionType: value === NO_TYPE ? "" : value })}
          />
        </Field>
        <Field
          label="Excerpt"
          optional
          description={`A short quote or summary from the article. ${form.excerpt.length} of ${EXCERPT_MAX} characters.`}
          error={errors.excerpt}
          disabled={busy}
        >
          <TextArea
            rows={3}
            value={form.excerpt}
            onChange={(event) => patch({ excerpt: event.target.value })}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
