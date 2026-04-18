export function readApiError(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

export type JsonFetchOpts = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  okRedirect: string;
  errRedirect: string;
  revalidatePaths?: string[];
};
