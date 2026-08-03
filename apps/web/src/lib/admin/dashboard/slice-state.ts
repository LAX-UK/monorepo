/** Discriminated slice state shared by staff dashboard modules. */
export type DashboardSlice<T> =
  | { status: "ready"; data: T }
  | { status: "empty"; data: T; message: string }
  | { status: "unavailable"; message: string; retryable: boolean };

export function readySlice<T>(data: T): DashboardSlice<T> {
  return { status: "ready", data };
}

export function emptySlice<T>(data: T, message: string): DashboardSlice<T> {
  return { status: "empty", data, message };
}

export function unavailableSlice<T>(message: string, retryable = true): DashboardSlice<T> {
  return { status: "unavailable", message, retryable };
}
