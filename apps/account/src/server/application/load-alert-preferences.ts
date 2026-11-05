import { getLaxAccountContainer } from "../container";
import type { AlertPreferencesRead } from "../ports/alert-preferences-gateway";
import { loadAccountSessionHandle } from "./load-account-record";

/**
 * The signed-in person's alert switches from every product, or null when nobody is signed in.
 * Each product answers independently, so one that is down shows as unavailable on its own.
 */
export async function loadAlertPreferences(): Promise<AlertPreferencesRead | null> {
  const handle = await loadAccountSessionHandle();
  if (!handle) return null;
  return getLaxAccountContainer().alerts.read(handle);
}
