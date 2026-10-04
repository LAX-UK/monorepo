export function assertMutationCsrf(input: {
  method: string;
  origin: string | null;
  expectedOrigin: string;
  csrfHeader: string | null;
  csrfCookie: string | null;
}): void {
  const method = input.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }
  if (!input.origin || input.origin !== input.expectedOrigin) {
    throw new Error("Cross-origin admin mutation rejected");
  }
  if (!input.csrfHeader || !input.csrfCookie || input.csrfHeader !== input.csrfCookie) {
    throw new Error("CSRF token missing or invalid");
  }
}
