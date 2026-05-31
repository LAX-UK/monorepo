const PII_KEY_PATTERN =
  /^(email|phone|ip|ipAddress|ipPrefix|password|passwordHash|token|bearerToken|stripeSecret|accessToken|refreshToken|secret|authorization|body|html|text|vars)$/i;

const MAX_REDACT_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function redactValue(key: string, value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_REDACT_DEPTH) return "[truncated]";
  if (PII_KEY_PATTERN.test(key)) {
    if (typeof value === "string" && value.length > 0) return "[redacted]";
    if (value != null) return "[redacted]";
  }
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    value.forEach((v, k) => {
      out[String(k)] = redactValue(String(k), v, depth + 1, seen);
    });
    return out;
  }
  if (value instanceof Set) {
    return Array.from(value, (item, index) => redactValue(String(index), item, depth + 1, seen));
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item, depth + 1, seen));
  }
  if (!isPlainObject(value)) return String(value);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = redactValue(k, v, depth + 1, seen);
  }
  return out;
}

/** Strip known PII keys from job payloads before admin display or Redis DLQ metadata. */
export function redactPayload(data: unknown): unknown {
  if (data == null || typeof data !== "object") return data;
  return redactValue("root", data, 0, new WeakSet());
}

function jsonReplacer(seen: WeakSet<object>): (_key: string, value: unknown) => unknown {
  return (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Map) {
      const out: Record<string, unknown> = {};
      value.forEach((v, k) => {
        out[String(k)] = v;
      });
      return out;
    }
    if (value instanceof Set) return Array.from(value);
    if (value != null && typeof value === "object") {
      if (seen.has(value)) return "[circular]";
      seen.add(value);
    }
    return value;
  };
}

/** JSON.stringify job payloads for DB replay storage; returns null when not serializable. */
export function safeSerializePayload(data: unknown): string | null {
  try {
    return JSON.stringify(data ?? null, jsonReplacer(new WeakSet()));
  } catch {
    return null;
  }
}

export function truncatePayloadJson(data: unknown, maxChars = 16_384): string {
  const json = safeSerializePayload(data) ?? JSON.stringify(null);
  if (json.length <= maxChars) return json;
  return `${json.slice(0, maxChars)}…[truncated]`;
}
