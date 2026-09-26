"use client";

/** Best-effort FedCM silent-access reset after explicit sign-out (Chromium). */
export async function preventFedcmSilentAccess(): Promise<void> {
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
