/** A refusal: a pure function declined the request and says why, in a code callers can branch on. */
export interface Refusal<C extends string = string> {
  readonly code: C;
  readonly message: string;
}

export type Result<T, C extends string = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: Refusal<C> };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function refuse<C extends string>(
  code: C,
  message: string,
): { readonly ok: false; readonly refusal: Refusal<C> } {
  return { ok: false, refusal: { code, message } };
}
