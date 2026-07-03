"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSplitOverlayOpenSm } from "@/hooks/use-split-overlay-open";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { useCallback, useEffect, useState } from "react";
import { emitQuickLookDeckNav } from "./lot-quick-look-analytics";
import { useLotQuickLook } from "./lot-quick-look-context";
import { LotQuickLookDeckNav } from "./lot-quick-look-deck-nav";
import { LotQuickLookLightbox } from "./lot-quick-look-lightbox";
import { QuickLookFooter } from "./quick-look-footer";
import {
  QuickLookBody,
  QuickLookMetaPanel,
} from "./quick-look-dialog-sections";
import {
  preloadQuickLookImage,
  quickLookOverlayMotion,
  quickLookPanelMotion,
  resolveQuickLookImages,
  type DeckDirection,
} from "./quick-look-dialog-utils";
import { useLotQuickLookEnrichment } from "./use-lot-quick-look-enrichment";

export function LotQuickLookDialog() {
  const { session, open, closeQuickLook, setDeckIndex, returnFocusRef } = useLotQuickLook();
  const reduceMotion = useReducedMotion();
  const [deckDirection, setDeckDirection] = useState<DeckDirection>(null);
  const [deckAnnounce, setDeckAnnounce] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeVm = session?.vm;
  const { displayVm, enriching, enrichmentAnnounce } = useLotQuickLookEnrichment({
    activeVm,
    deckSourceLabel: session?.options.deckSourceLabel,
  });

  useEffect(() => {
    if (activeVm) setImageIndex(0);
  }, [activeVm?.id]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setDeckDirection(null);
        setLightboxOpen(false);
        closeQuickLook();
      }
    },
    [closeQuickLook],
  );

  const { mobile, desktop } = useSplitOverlayOpenSm(open, handleOpenChange);

  const handleCtaNavigate = useCallback(() => {
    setLightboxOpen(false);
    closeQuickLook();
  }, [closeQuickLook]);

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      const el = returnFocusRef.current;
      if (el) {
        event.preventDefault();
        el.focus();
      }
    },
    [returnFocusRef],
  );

  const vm = displayVm ?? session?.vm;
  const deckIndex = session?.deckIndex ?? 0;
  const deckLength = session?.options.deck?.length ?? 0;
  const images = vm ? resolveQuickLookImages(vm) : [];
  const multiImage = images.length > 1;

  const goDeckPrev = useCallback(() => {
    if (deckIndex <= 0) return;
    setDeckDirection("right");
    setDeckIndex(deckIndex - 1);
    emitQuickLookDeckNav(session?.vm.id ?? "", "prev");
  }, [deckIndex, setDeckIndex, session?.vm.id]);

  const goDeckNext = useCallback(() => {
    if (deckIndex >= deckLength - 1) return;
    setDeckDirection("left");
    setDeckIndex(deckIndex + 1);
    emitQuickLookDeckNav(session?.vm.id ?? "", "next");
  }, [deckIndex, deckLength, setDeckIndex, session?.vm.id]);

  useEffect(() => {
    if (!open || !vm) return;
    if (deckLength > 1) {
      setDeckAnnounce(`Lot ${deckIndex + 1} of ${deckLength}: ${vm.title}`);
    }
  }, [open, vm, deckIndex, deckLength]);

  useEffect(() => {
    const deck = session?.options.deck;
    if (!deck || deck.length <= 1) return;
    for (const offset of [-1, 1]) {
      const neighbor = deck[deckIndex + offset];
      if (!neighbor) continue;
      const src = neighbor.images?.[0] ?? neighbor.imageUrl;
      if (src) preloadQuickLookImage(src);
    }
  }, [deckIndex, session?.options.deck]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (lightboxOpen) return;

      const useDeck = e.shiftKey || !multiImage;
      if (useDeck && deckLength > 1) {
        e.preventDefault();
        if (e.key === "ArrowLeft") goDeckPrev();
        else goDeckNext();
        return;
      }

      if (multiImage) {
        e.preventDefault();
        setImageIndex((i) =>
          e.key === "ArrowLeft" ? Math.max(0, i - 1) : Math.min(images.length - 1, i + 1),
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, lightboxOpen, multiImage, deckLength, images.length, goDeckPrev, goDeckNext]);

  if (!open || !session || !vm) return null;

  const { options } = session;
  const contextLabel =
    options.deckSourceLabel ??
    (deckLength > 1 ? `Quick look · ${deckIndex + 1} of ${deckLength}` : "Quick look");
  const contextId = "quick-look-context";
  const statusId = "quick-look-status";

  const quickLookInner = (
    <>
      <output className="sr-only" aria-live="polite">
        {enrichmentAnnounce}
      </output>
      <output className="sr-only" aria-live="polite">
        {deckAnnounce}
      </output>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="shrink-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <QuickLookBody
            key={vm.id}
            vm={vm}
            enriching={enriching}
            deckDirection={deckDirection}
            imageIndex={imageIndex}
            onImageIndexChange={setImageIndex}
            onHeroClick={() => {
              if (images.length > 0) setLightboxOpen(true);
            }}
            deckNav={
              deckLength > 1 ? (
                <LotQuickLookDeckNav
                  variant="hero-overlay"
                  deckIndex={deckIndex}
                  deckLength={deckLength}
                  onPrev={goDeckPrev}
                  onNext={goDeckNext}
                />
              ) : null
            }
          />
        </div>

        <QuickLookMetaPanel
          vm={vm}
          enriching={enriching}
          deckDirection={deckDirection}
          contextLabel={contextLabel}
          contextId={contextId}
          statusId={statusId}
          deckIndex={deckIndex}
          deckLength={deckLength}
          onClose={() => handleOpenChange(false)}
          onDeckPrev={goDeckPrev}
          onDeckNext={goDeckNext}
        />
      </div>

      <QuickLookFooter vm={vm} options={options} onCtaNavigate={handleCtaNavigate} />

      <LotQuickLookLightbox
        title={vm.title}
        images={images}
        index={imageIndex}
        open={lightboxOpen}
        onIndexChange={setImageIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );

  return (
    <>
      <BottomSheet {...mobile}>
        <BottomSheetContent
          overlayClassName="sm:hidden"
          className={cn(
            "flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-outline-variant/25 bg-surface-container-lowest p-0 sm:hidden",
            quickLookPanelMotion(reduceMotion),
          )}
        >
          <BottomSheetTitle className="sr-only">{vm.title}</BottomSheetTitle>
          <BottomSheetDescription className="sr-only">{vm.subtitle}</BottomSheetDescription>
          {quickLookInner}
        </BottomSheetContent>
      </BottomSheet>

      <Dialog {...desktop}>
        <DialogContent
          onCloseAutoFocus={handleCloseAutoFocus}
          onEscapeKeyDown={(e) => {
            if (lightboxOpen) {
              e.preventDefault();
              setLightboxOpen(false);
            }
          }}
          overlayClassName={cn(
            "hidden sm:block z-[var(--z-overlay,60)]",
            quickLookOverlayMotion(reduceMotion),
          )}
          closeClassName="hidden sm:inline-flex"
          className={cn(
            "hidden max-h-[85vh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden border-outline-variant/25 bg-surface-container-lowest p-0 sm:flex",
            "z-[var(--z-overlay,60)]",
            "top-[50%] translate-x-[-50%] translate-y-[-50%]",
            "rounded-lg",
            quickLookPanelMotion(reduceMotion),
          )}
        >
          <DialogTitle className="sr-only">{vm.title}</DialogTitle>
          <DialogDescription className="sr-only">{vm.subtitle}</DialogDescription>
          {quickLookInner}
        </DialogContent>
      </Dialog>
    </>
  );
}
