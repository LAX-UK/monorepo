export type UserHttpJson = { status: number; body: unknown };

export type UserRouteServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type UserRouteOk<T> = { kind: "ok"; data: T; status?: number };
export type UserRouteNoContent = { kind: "no_content" };
export type UserRouteErr = { kind: "err"; error: UserRouteServiceError };

export type UserRouteOutcome<T> = UserRouteOk<T> | UserRouteNoContent | UserRouteErr;

export function userRouteCodeErr(code: string, status: number): UserRouteErr {
  return { kind: "err", error: { message: code, status, code } };
}
