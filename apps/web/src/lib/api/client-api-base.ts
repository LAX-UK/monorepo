/** Shared browser API origin for dashboard client boards. */
export function clientApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!configured && process.env.NODE_ENV === "production") {
    console.error("NEXT_PUBLIC_API_URL is not configured — client API calls will fail");
  }
  return configured ?? "http://localhost:3001";
}
