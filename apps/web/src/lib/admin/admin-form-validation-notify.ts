import { humanizeSetupError } from "@/lib/admin/sale-setup/humanize-setup-error";
import type { FieldErrorMap } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import type { ZodIssue } from "zod";

const VALIDATION_FALLBACK = "Fix the highlighted fields before saving.";

export function humanizeAdminFormError(message: string): string {
  return humanizeSetupError({ message });
}

export function summarizeZodIssues(
  issues: readonly Pick<ZodIssue, "message">[],
  maxShown = 1,
): string {
  if (issues.length === 0) return VALIDATION_FALLBACK;

  const humanized = issues.map((issue) => humanizeAdminFormError(issue.message));
  const shown = humanized.slice(0, maxShown);
  const first = shown[0] ?? VALIDATION_FALLBACK;
  const remaining = humanized.length - shown.length;

  if (remaining <= 0) return first;
  const noun = remaining === 1 ? "field" : "fields";
  return `${first} — and ${remaining} more ${noun} need attention.`;
}

export function summarizeFieldErrors(fieldErrors: FieldErrorMap, maxShown = 1): string {
  const messages = Object.values(fieldErrors)
    .flatMap((msgs) => msgs ?? [])
    .filter(Boolean);
  if (messages.length === 0) return VALIDATION_FALLBACK;
  return summarizeZodIssues(
    messages.map((message) => ({ message })),
    maxShown,
  );
}

export function buildAdminFormValidationMessage(input: {
  issues?: readonly Pick<ZodIssue, "message">[];
  fieldErrors?: FieldErrorMap;
}): string {
  if (input.issues?.length) return summarizeZodIssues(input.issues);
  if (input.fieldErrors) return summarizeFieldErrors(input.fieldErrors);
  return VALIDATION_FALLBACK;
}

/** Toast staff-friendly validation copy (never the generic "Check the form for errors"). */
export function notifyAdminFormValidationFailure(input: {
  issues?: readonly Pick<ZodIssue, "message">[];
  fieldErrors?: FieldErrorMap;
}): void {
  notify.error(buildAdminFormValidationMessage(input));
}
