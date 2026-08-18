const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DisplayProxyRequestPolicy = {
  body: "none" | "json";
  requiresDisplayBearer: boolean;
  upstreamPath: string;
};

export function displayProxyRequestPolicy(
  method: string,
  segments: readonly string[],
): DisplayProxyRequestPolicy | null {
  const normalizedMethod = method.toUpperCase();
  if (
    normalizedMethod === "POST" &&
    segments.length === 2 &&
    segments[0] === "pair" &&
    segments[1] === "start"
  ) {
    return { body: "none", requiresDisplayBearer: false, upstreamPath: "/display/pair/start" };
  }
  if (
    normalizedMethod === "POST" &&
    segments.length === 2 &&
    segments[0] === "pair" &&
    segments[1] === "poll"
  ) {
    return { body: "json", requiresDisplayBearer: false, upstreamPath: "/display/pair/poll" };
  }
  if (
    normalizedMethod === "GET" &&
    segments.length === 2 &&
    UUID_PATTERN.test(segments[0] ?? "") &&
    segments[1] === "snapshot"
  ) {
    return {
      body: "none",
      requiresDisplayBearer: true,
      upstreamPath: `/display/${segments[0]}/snapshot`,
    };
  }
  if (normalizedMethod === "POST" && segments.length === 1 && segments[0] === "heartbeat") {
    return { body: "none", requiresDisplayBearer: true, upstreamPath: "/display/heartbeat" };
  }
  return null;
}

export function displayProxyRequestHeaders(
  source: Headers,
  policy: DisplayProxyRequestPolicy,
  upstreamOrigin: string,
): Headers | null {
  const result = new Headers({ origin: upstreamOrigin });
  const accept = source.get("accept");
  if (accept) result.set("accept", accept);

  if (policy.requiresDisplayBearer) {
    const authorization = source.get("authorization");
    if (
      !authorization?.startsWith("Bearer ") ||
      authorization.slice("Bearer ".length).trim() === ""
    ) {
      return null;
    }
    result.set("authorization", authorization);
  }

  if (policy.body === "json") {
    const contentType = source.get("content-type");
    if (!contentType?.toLowerCase().startsWith("application/json")) return null;
    result.set("content-type", contentType);
  }

  return result;
}
