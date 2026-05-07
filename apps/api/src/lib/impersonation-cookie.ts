import {
  ACTING_LEGAL_ENTITY_COOKIE_NAME,
  type ActingContextCookieV1,
  decodeActingContextCookie,
} from "@auction/types";

export function parseActingLegalEntityCookieFromHeader(
  cookieHeader: string | undefined | null,
): ActingContextCookieV1 | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTING_LEGAL_ENTITY_COOKIE_NAME}=([^;]*)`),
  );
  const raw = match?.[1];
  if (!raw) return null;
  try {
    return decodeActingContextCookie(decodeURIComponent(raw.trim()));
  } catch {
    return decodeActingContextCookie(raw.trim());
  }
}
