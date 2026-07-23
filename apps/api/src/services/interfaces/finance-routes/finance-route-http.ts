export type FinanceRouteServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type FinanceRouteOk<T> = { kind: "ok"; data: T; status?: number };
export type FinanceRouteErr = { kind: "err"; error: FinanceRouteServiceError };
export type FinanceRouteOutcome<T> = FinanceRouteOk<T> | FinanceRouteErr;

export type FinanceRouteJsonBody = Record<string, unknown> | unknown[] | null;

export type FinanceHttpJson = {
  status: number;
  body: FinanceRouteJsonBody;
};
