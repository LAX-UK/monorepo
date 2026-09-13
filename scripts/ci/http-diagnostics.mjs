const DEFAULT_BODY_LIMIT = 500;

/**
 * Return bounded HTTP rejection details without dumping an unbounded response
 * body into CI logs. Both retry header spellings are included because the
 * issuer Redis limiter and Better Auth use different names.
 */
export async function describeRejection(response, bodyLimit = DEFAULT_BODY_LIMIT) {
  const body = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim();
  const suffix = body.length > bodyLimit ? "…" : "";
  const excerpt = body.slice(0, bodyLimit);
  const retryAfter = response.headers.get("retry-after") ?? "(none)";
  const xRetryAfter = response.headers.get("x-retry-after") ?? "(none)";
  return `status=${response.status} retry-after=${retryAfter} x-retry-after=${xRetryAfter} body=${JSON.stringify(`${excerpt}${suffix}`)}`;
}
