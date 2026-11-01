import { z } from "zod";

/**
 * The words public forms use for validation errors, in one place. A schema states its own message
 * where the field has something specific to say (`errorCopy.required("your email address")`); the
 * `publicFormErrorMap` supplies a human default for everything else, so raw validator text never
 * reaches a person.
 */

const formatLimit = (limit: number) => limit.toLocaleString("en-GB");

export const errorCopy = {
  /** An empty required field: "Enter your first name". */
  required: (what: string) => `Enter ${what}`,
  /** An empty required choice: "Choose a topic". */
  requiredChoice: (what: string) => `Choose ${what}`,
  email: "Enter an email address like name@example.com",
  phone: "Enter a phone number, like 07700 900123 or +44 20 7946 0000",
  /** A minimum length: "Tell us a little more: at least 10 characters". */
  minLength: (limit: number, prompt = "Add a little more") =>
    `${prompt}: at least ${formatLimit(limit)} characters`,
  /** A maximum length: "Keep your message under 5,000 characters". */
  maxLength: (limit: number, what = "your answer") =>
    `Keep ${what} under ${formatLimit(limit)} characters`,
  /** A choice outside the list. */
  invalidChoice: "Choose one of the options",
  /** The fallback when nothing more specific applies. */
  invalid: "Check this answer and try again",
} as const;

/** Server failure for a submitted form: the notice title and its detail. */
export const submitFailureCopy = {
  title: "We couldn't send your message",
  detail: (email: string) => `Your text is still here. Try again, or email ${email}.`,
} as const;

/**
 * Zod's own wording replaced with the copy above. An explicit message on a schema always wins; this
 * only answers for the checks that did not state one. Pass it as the resolver's `errorMap`.
 */
export const publicFormErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: errorCopy.email };
      return { message: errorCopy.invalid };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string" && Number(issue.minimum) <= 1) {
        return { message: errorCopy.required("a value") };
      }
      if (issue.type === "string") return { message: errorCopy.minLength(Number(issue.minimum)) };
      return { message: errorCopy.invalid };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: errorCopy.maxLength(Number(issue.maximum)) };
      return { message: errorCopy.invalid };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: errorCopy.invalidChoice };
    case z.ZodIssueCode.invalid_type:
      return {
        message: issue.received === "undefined" ? errorCopy.required("a value") : errorCopy.invalid,
      };
    default:
      return { message: ctx.defaultError };
  }
};
