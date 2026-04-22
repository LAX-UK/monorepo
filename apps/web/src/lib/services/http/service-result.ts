import { readApiError } from "@/lib/actions/_utils";

export type ServiceResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; message: string; status: number; body?: unknown };

export function serviceSuccess<T>(data: T, status: number): ServiceResult<T> {
  return { ok: true, data, status };
}

export function serviceFailure(
  message: string,
  status: number,
  body?: unknown,
): ServiceResult<never> {
  return { ok: false, message, status, body };
}

export function bodyToServiceFailure(
  body: unknown,
  status: number,
  fallback: string,
): ServiceResult<never> {
  return serviceFailure(readApiError(body, fallback), status, body);
}
