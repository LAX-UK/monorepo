import type { ContentfulStatusCode } from "hono/utils/http-status";

export function asHttpStatus(code: number): ContentfulStatusCode {
  return code as ContentfulStatusCode;
}
