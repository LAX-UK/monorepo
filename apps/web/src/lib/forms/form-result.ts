import type { ZodError } from "zod";

/** Field path → error messages (RHF `setError` / `formState`) */
export type FieldErrorMap = Record<string, string[] | undefined>;

/**
 * Server action return shape for RHF: success or structured failure with optional field errors.
 */
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrorMap; status?: number };

export function actionSuccess<T = void>(data?: T): ActionResult<T> {
  return data === undefined ? { ok: true } : { ok: true, data };
}

export function actionFailure(
  error: string,
  fieldErrors?: FieldErrorMap,
  status?: number,
): ActionResult<never> {
  return {
    ok: false,
    error,
    ...(fieldErrors !== undefined ? { fieldErrors } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

export function zodErrorToFieldErrors(err: ZodError): FieldErrorMap {
  const out: FieldErrorMap = {};
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "root";
    if (!out[key]) out[key] = [];
    out[key]?.push(issue.message);
  }
  return out;
}

export function firstZodErrorMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Validation failed";
}
