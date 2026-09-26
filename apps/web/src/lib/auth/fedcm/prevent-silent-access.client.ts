"use client";

/** Best-effort FedCM silent-access reset after explicit sign-out (Chromium). */
export async function preventFedcmSilentAccess(): Promise<void> {
  if (process.env.NEXT_PUBLIC_FEDCM_ENABLED !== "true") return;
  const credentials = globalThis.navigator?.credentials as
    | { preventSilentAccess?: () => Promise<void> }
    | undefined;
  if (!credentials?.preventSilentAccess) return;
  try {
    await credentials.preventSilentAccess();
  } catch {
    // ignore — optional browser API
  }
}
