/** Shared browser API origin for dashboard client boards. */
export function clientApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}
