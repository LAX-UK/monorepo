import type { AdminApiClient } from "../ports/admin-api-client";

export function createFetchAdminApiClient(): AdminApiClient {
  return {
    async forward(input) {
      const headers = new Headers(input.headers);
      headers.set("authorization", `Bearer ${input.accessToken}`);
      const init: RequestInit = { method: input.method, headers };
      if (input.body !== undefined) {
        init.body = input.body;
      }
      const response = await fetch(input.url, init);
      const body = await response.arrayBuffer();
      const outHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        outHeaders[key] = value;
      });
      return { status: response.status, headers: outHeaders, body };
    },
  };
}
