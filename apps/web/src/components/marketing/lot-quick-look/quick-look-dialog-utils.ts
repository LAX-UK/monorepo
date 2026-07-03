import { cn } from "@auction/ui";

export type DeckDirection = "left" | "right" | null;

export function quickLookOverlayMotion(reduceMotion: boolean): string {
  if (reduceMotion) {
    return "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:fade-in-0 motion-safe:fade-out-0 duration-100";
  }
  return cn(
    "backdrop-blur-sm",
    "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out",
    "motion-safe:fade-in-0 motion-safe:fade-out-0 duration-300",
  );
}

export function quickLookPanelMotion(reduceMotion: boolean): string {
  if (reduceMotion) {
    return "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:fade-in-0 motion-safe:fade-out-0 duration-100";
  }
  return cn(
    "duration-300",
    "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out",
    "motion-safe:fade-in-0 motion-safe:fade-out-0",
    "motion-safe:slide-in-from-bottom-[100%] motion-safe:slide-out-to-bottom-[100%]",
    "sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:slide-out-to-bottom-0",
    "sm:motion-safe:zoom-in-95 sm:motion-safe:zoom-out-95",
  );
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
