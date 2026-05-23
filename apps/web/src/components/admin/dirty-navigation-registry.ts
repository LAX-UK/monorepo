"use client";

/**
 * Shared registry for "the page has unsaved changes" guards.
 *
 * `FormDirtyGuard` registers itself here whenever its `isDirty` prop is true;
 * other code can call {@link confirmGuardedNavigation} to ask the user before
 * navigating away. This works around the fact that Next.js `router.push` /
 * `router.replace` bypass anchor-click interceptors.
 */
type Entry = {
  message: string;
};

const guards = new Set<Entry>();

type ConfirmOpener = (message: string) => Promise<boolean>;

let confirmOpener: ConfirmOpener | null = null;

export function registerDirtyGuard(entry: Entry): () => void {
  guards.add(entry);
  return () => {
    guards.delete(entry);
  };
}

/** Registers the in-app confirm dialog opener (from {@link FormDirtyGuard}). */
export function registerDirtyConfirmOpener(opener: ConfirmOpener | null): void {
  confirmOpener = opener;
}

/**
 * Returns true when the caller should proceed with the navigation.
 * Uses the registered in-app dialog — never `window.confirm` or `beforeunload`.
 */
export async function confirmWithMessage(message: string): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!confirmOpener) return true;
  return confirmOpener(message);
}

export async function confirmGuardedNavigation(): Promise<boolean> {
  if (guards.size === 0) return true;
  const first = guards.values().next().value as Entry | undefined;
  const message = first?.message ?? "You have unsaved changes. Leave this page?";
  return confirmWithMessage(message);
}
