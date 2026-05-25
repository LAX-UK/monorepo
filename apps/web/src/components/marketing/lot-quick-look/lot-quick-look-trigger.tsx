"use client";

import { useOverlayTone, useOverlayToneContext } from "@/components/ui/overlay-tone-context";
import type { SlotName } from "@/lib/media/overlay-tone-types";
import { overlayIconButtonClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";
import { Eye } from "lucide-react";
import { type MouseEvent, useRef } from "react";
import { useLotQuickLookOptional } from "./lot-quick-look-context";
import type { LotQuickLookOpenOptions, LotQuickLookVM } from "./types";

type LayoutMode = "overlay" | "inline";

type Props = {
  vm: LotQuickLookVM;
  options: Omit<LotQuickLookOpenOptions, "deck" | "deckIndex"> & {
    deck?: LotQuickLookVM[];
    deckIndex?: number;
  };
  className?: string;
  layout?: LayoutMode;
  /** Adaptive tone slot when using overlay chrome (default bottomLeft). */
  overlaySlot?: SlotName;
  /** Override default aria-label */
  ariaLabel?: string;
};

const inlineShellClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand motion-reduce:transition-none";

export function LotQuickLookTrigger({
  vm,
  options,
  className,
  layout = "inline",
  overlaySlot = "bottomLeft",
  ariaLabel,
}: Props) {
  const quickLook = useLotQuickLookOptional();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inFrame = useOverlayToneContext() != null;
  const overlayTone = useOverlayTone(overlaySlot);
  const useOverlayChrome = layout === "overlay" || inFrame;

  if (!quickLook) return null;

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    quickLook?.openQuickLook(vm, options as LotQuickLookOpenOptions, triggerRef);
  }

  const shell = useOverlayChrome
    ? overlayIconButtonClasses(overlayTone, "size-11 shrink-0")
    : inlineShellClass;
  const label = ariaLabel ?? `Quick look at ${vm.title}`;

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleClick}
      className={cn(shell, className)}
      {...(useOverlayChrome ? overlayToneProps(overlayTone) : {})}
      aria-label={label}
    >
      <Eye className="size-5 shrink-0" aria-hidden />
    </button>
  );
}
