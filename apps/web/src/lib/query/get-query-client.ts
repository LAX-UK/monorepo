import { QUERY_DEFAULT_OPTIONS } from "@/lib/query/defaults";
import { QueryClient } from "@tanstack/react-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: QUERY_DEFAULT_OPTIONS,
  });
}

let browserQueryClient: QueryClient | undefined;

/** Per-request on the server; singleton in the browser (TanStack Query App Router pattern). */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
