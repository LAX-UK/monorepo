"use server";

import {
  CONSENT_COOKIE_MAX_AGE_SEC,
  CONSENT_COOKIE_NAME,
  type ConsentSnapshot,
  buildConsentSnapshot,
  serializeConsent,
} from "@/lib/analytics/consent/cookie";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

function cookieOptions() {
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() || undefined;
  return {
    path: "/" as const,
    maxAge: CONSENT_COOKIE_MAX_AGE_SEC,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  };
}

export async function setConsentAction(prefs: {
  analytics: boolean;
  marketing: boolean;
}): Promise<{ ok: true; snapshot: ConsentSnapshot } | { ok: false; error: string }> {
  try {
    const snapshot = buildConsentSnapshot(prefs);
    const jar = await cookies();
    jar.set(CONSENT_COOKIE_NAME, serializeConsent(snapshot), cookieOptions());
    revalidatePath("/", "layout");
    return { ok: true, snapshot };
  } catch {
    return { ok: false, error: "Could not save cookie preferences." };
  }
}
