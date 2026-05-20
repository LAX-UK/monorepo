export type WizardDraftPayload = {
  stepIndex: number;
  values: Record<string, unknown>;
  savedAt: string;
};

const DRAFT_PREFIX = "lax_admin_wizard_draft:";

export function wizardDraftCookieKey(entityKind: string, entityId: string): string {
  return `${DRAFT_PREFIX}${entityKind}:${entityId}`;
}

export function readWizardDraft(key: string): WizardDraftPayload | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${key}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(key.length + 1));
  try {
    const parsed = JSON.parse(raw) as WizardDraftPayload;
    if (typeof parsed.stepIndex !== "number" || typeof parsed.savedAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWizardDraft(key: string, payload: WizardDraftPayload): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(payload));
  const maxAge = 60 * 60 * 24 * 7;
  document.cookie = `${key}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearWizardDraft(key: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
}
