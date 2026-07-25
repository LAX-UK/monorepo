export type Ga4BrowserIds = {
  clientId: string;
  sessionId?: string;
};

const CLIENT_ID_PATTERN = /^\d{1,20}\.\d{1,20}$/;
const SESSION_ID_PATTERN = /^\d{1,20}$/;

export function parseGa4BrowserIdsHeader(raw: string | undefined): Ga4BrowserIds | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > 256) return null;
  try {
    const parsed = JSON.parse(trimmed) as { clientId?: unknown; sessionId?: unknown };
    if (typeof parsed.clientId !== "string" || !CLIENT_ID_PATTERN.test(parsed.clientId.trim())) {
      return null;
    }
    const clientId = parsed.clientId.trim();
    const sessionId =
      typeof parsed.sessionId === "string" && SESSION_ID_PATTERN.test(parsed.sessionId.trim())
        ? parsed.sessionId.trim()
        : undefined;
    return sessionId ? { clientId, sessionId } : { clientId };
  } catch {
    return null;
  }
}
