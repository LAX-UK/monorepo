export type DeckDirection = "left" | "right" | null;

/**
 * The scrim's blur. Its fade and the panel's motion come from the shared kit
 * (`data-lax-motion`, packages/ui/src/lax/motion.css); only the static blur is set here, and
 * not under reduced motion.
 */
export function quickLookOverlayBlur(reduceMotion: boolean): string {
  return reduceMotion ? "" : "backdrop-blur-sm";
}

export function deckEnterClass(direction: DeckDirection): string {
  if (direction === "left") return "quick-look-deck-enter-from-right";
  if (direction === "right") return "quick-look-deck-enter-from-left";
  return "";
}

export function resolveQuickLookImages(vm: {
  images?: string[];
  imageUrl: string | null;
}): string[] {
  return vm.images?.length ? vm.images : vm.imageUrl ? [vm.imageUrl] : [];
}

export function preloadQuickLookImage(url: string): void {
  const img = new Image();
  img.src = url;
}
