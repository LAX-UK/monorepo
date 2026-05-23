export type WizardDraftPayload = {
  stepIndex: number;
  values: Record<string, unknown>;
  savedAt: string;
};

const DRAFT_PREFIX = "lax_admin_wizard_draft:";
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Compute the storage key for a wizard's draft.
 *
 * The function is named `…CookieKey` for historical reasons — drafts used to
 * be persisted in `document.cookie`. They now live in `localStorage` (much
 * larger quota, no per-request transmission) but the key shape is the same.
 */
export function wizardDraftCookieKey(entityKind: string, entityId: string): string {
  return `${DRAFT_PREFIX}${entityKind}:${entityId}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDraft(value: unknown): value is WizardDraftPayload {
  if (!isPlainObject(value)) return false;
  if (typeof value.stepIndex !== "number" || !Number.isFinite(value.stepIndex)) return false;
  if (typeof value.savedAt !== "string") return false;
  if (!isPlainObject(value.values)) return false;
  return true;
}

export function readWizardDraft(key: string): WizardDraftPayload | null {
  const storage = getStorage();
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidDraft(parsed)) return null;
    const savedAtMs = Date.parse(parsed.savedAt);
    if (Number.isFinite(savedAtMs) && Date.now() - savedAtMs > TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeWizardDraft(key: string, payload: WizardDraftPayload): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — best-effort, draft simply not saved.
  }
}

export function clearWizardDraft(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Overlay persisted draft field values onto a form baseline (Resume draft). */
export function mergeWizardDraftValues<T extends Record<string, unknown>>(
  baseline: T,
  draftValues: Record<string, unknown>,
): T {
  return {
    ...baseline,
    ...draftValues,
  } as T;
}
