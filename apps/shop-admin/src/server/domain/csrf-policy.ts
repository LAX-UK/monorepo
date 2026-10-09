export function assertMutationCsrf(input: {
  method: string;
  origin: string | null;
  expectedOrigin: string;
  csrfHeader: string | null;
  csrfCookie: string | null;
  /** Next.js Server Actions send Origin; double-submit uses x-csrf-token on API routes. */
  fromServerAction?: boolean;
}): void {
  const method = input.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }
  if (!input.origin || input.origin !== input.expectedOrigin) {
    throw new Error("Cross-origin admin mutation rejected");
  }
  if (input.fromServerAction) {
    return;
  }
  if (!input.csrfHeader || !input.csrfCookie || input.csrfHeader !== input.csrfCookie) {
    throw new Error("CSRF token missing or invalid");
  }
}
