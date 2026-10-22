import type { FieldErrors } from "@/lib/form-validation";
import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/**
 * Checks a request body against the same TypeBox schema shop-api validates it with, so the form
 * rejects what the server would reject. Returns one message per top-level field; `messages`
 * supplies the wording, and a field without an entry falls back to the schema's own message.
 */
export function schemaFieldErrors(
  schema: TSchema,
  body: unknown,
  messages: Record<string, string>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of Value.Errors(schema, body)) {
    const field = issue.path.split("/")[1] ?? "";
    if (field && !(field in errors)) errors[field] = messages[field] ?? issue.message;
  }
  return errors;
}
