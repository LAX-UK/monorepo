import {
  type PalettePinnedRef,
  parsePinnedCookie,
  serializePinnedCookie,
  togglePinned,
} from "@/components/layout/palette/pinned-store";
import {
  type PaletteEntityKind,
  type PaletteRecentRef,
  parseRecentsCookie,
  pushRecent,
  serializeRecentsCookie,
} from "@/components/layout/palette/recents-store";
import { readCookie } from "@auction/ui";

const RECENTS_COOKIE = "lax_palette_recents";
const PINNED_COOKIE = "lax_palette_pinned";
const MAX_AGE_SEC = 60 * 60 * 24 * 90;
export const PALETTE_PINNED_CHANGE_EVENT = "lax:palette-pinned-change";

function readPaletteCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  return readCookie(document.cookie, name) || null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function readPaletteRecents(): PaletteRecentRef[] {
  return parseRecentsCookie(readPaletteCookie(RECENTS_COOKIE));
}

export function pushPaletteRecent(entry: {
  kind: PaletteEntityKind;
  id: string;
  label: string;
  href: string;
}): void {
  const next = pushRecent(readPaletteRecents(), entry);
  writeCookie(RECENTS_COOKIE, serializeRecentsCookie(next));
}

export function readPalettePinned(): PalettePinnedRef[] {
  return parsePinnedCookie(readPaletteCookie(PINNED_COOKIE));
}

export function isPalettePinned(kind: PaletteEntityKind, id: string): boolean {
  return readPalettePinned().some((p) => p.kind === kind && p.id === id);
}

export function togglePalettePinned(entry: Omit<PalettePinnedRef, "pinnedAt">): boolean {
  const prev = readPalettePinned();
  const exists = prev.some((p) => p.kind === entry.kind && p.id === entry.id);
  const next = togglePinned(prev, entry);
  writeCookie(PINNED_COOKIE, serializePinnedCookie(next));
  window.dispatchEvent(new Event(PALETTE_PINNED_CHANGE_EVENT));
  return !exists;
}
