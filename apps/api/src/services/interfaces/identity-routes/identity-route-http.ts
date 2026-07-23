/** Direct JSON response for endpoints that do not use the `{ data }` envelope. */
export type IdentityHttpJson = { status: number; body: unknown };

export type IdentityRouteServiceError = {
  message: string;
  status: number;
  code?: string;
  hint?: string;
};

export type IdentityRouteOk<T> = { kind: "ok"; data: T; status?: number };
export type IdentityRouteNoContent = { kind: "no_content" };
export type IdentityRouteErr = { kind: "err"; error: IdentityRouteServiceError };

export type IdentityRouteOutcome<T> =
  | IdentityRouteOk<T>
  | IdentityRouteNoContent
  | IdentityRouteErr;

export function identityRouteErr(
  error: string | IdentityRouteServiceError,
  status = 400,
): IdentityRouteErr {
  if (typeof error === "string") {
    return { kind: "err", error: { message: error, status } };
  }
  return { kind: "err", error };
}

export function identityRouteCodeErr(code: string, status: number): IdentityRouteErr {
  return { kind: "err", error: { message: code, status, code } };
}
