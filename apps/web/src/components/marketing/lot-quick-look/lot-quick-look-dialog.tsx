"use client";

import { LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { ShareButton } from "@/components/marketing/share-button";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSplitOverlayOpenSm } from "@/hooks/use-split-overlay-open";
import { trackQuickLookEnrichmentMs } from "@/lib/analytics/events";
import { recordRecentlyViewedLot } from "@/lib/marketing/recently-viewed-lots";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import Link from "next/link";
import { type ReactNode, type TouchEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLotQuickLookEnrichment,
  mergeLotQuickLookEnrichment,
} from "./fetch-lot-quick-look-enrichment.client";
import {
  emitQuickLookCta,
  emitQuickLookDeckNav,
  emitQuickLookOpen,
} from "./lot-quick-look-analytics";
import { useLotQuickLook } from "./lot-quick-look-context";
import { LotQuickLookDeckNav } from "./lot-quick-look-deck-nav";
import { LotQuickLookLightbox } from "./lot-quick-look-lightbox";
import { type LotQuickLookVM, isLotQuickLookBiddable } from "./types";

type DeckDirection = "left" | "right" | null;

function quickLookOverlayMotion(reduceMotion: boolean): string {
  if (reduceMotion) {
    return "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:fade-in-0 motion-safe:fade-out-0 duration-100";
  }
  return cn(
    "backdrop-blur-sm",
    "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out",
    "motion-safe:fade-in-0 motion-safe:fade-out-0 duration-300",
  );
}

function quickLookPanelMotion(reduceMotion: boolean): string {
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

function deckEnterClass(direction: DeckDirection): string {
  if (direction === "left") return "quick-look-deck-enter-from-right";
  if (direction === "right") return "quick-look-deck-enter-from-left";
  return "";
}

function resolveImages(vm: LotQuickLookVM): string[] {
  return vm.images?.length ? vm.images : vm.imageUrl ? [vm.imageUrl] : [];
}

function PricingCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] min-w-0 flex-col gap-0.5 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3",
        className,
      )}
    >
      <span className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <span className="line-clamp-2 font-body text-sm font-medium text-on-surface">{value}</span>
    </div>
  );
}

function QuickLookPricingCards({ vm }: { vm: LotQuickLookVM }) {
  const estimateLabel = vm.estimateLabel;
  const estimateValue = vm.estimateValue;
  const currentBidLabel = vm.currentBidLabel;
  const currentBidValue = vm.currentBidValue;
  const minNextBidLabel = vm.minNextBidLabel;
  const minNextBidValue = vm.minNextBidValue;

  const hasEstimate = Boolean(estimateLabel && estimateValue);
  const hasCurrentBid = Boolean(currentBidLabel && currentBidValue);
  const hasMinNext = Boolean(vm.status === "active" && minNextBidLabel && minNextBidValue);

  if (!hasEstimate && !hasCurrentBid && !hasMinNext) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {hasEstimate && estimateLabel && estimateValue ? (
        <PricingCard label={estimateLabel} value={estimateValue} />
      ) : null}
      {hasCurrentBid && currentBidLabel && currentBidValue ? (
        <PricingCard label={currentBidLabel} value={currentBidValue} />
      ) : null}
      {hasMinNext && minNextBidLabel && minNextBidValue ? (
        <PricingCard label={minNextBidLabel} value={minNextBidValue} className="col-span-2" />
      ) : null}
    </div>
  );
}

function QuickLookStatusBand({ vm, statusId }: { vm: LotQuickLookVM; statusId: string }) {
  return (
    <div id={statusId} className="flex min-h-8 shrink-0 flex-wrap items-center gap-2">
      {vm.lotLabel ? (
        <span className="font-body text-xs font-bold uppercase tracking-wide text-lot-orange">
          {vm.lotLabel}
        </span>
      ) : null}
      {vm.startTime && vm.endTime ? (
        <LotStatusTimer
          layout="inline"
          variant="endingSoon"
          status={vm.status}
          startTime={vm.startTime}
          endTime={vm.endTime}
        />
      ) : null}
    </div>
  );
}

function QuickLookImageStrip({
  vm,
  activeIndex,
  onSelect,
  enriching,
  inDock = false,
}: {
  vm: LotQuickLookVM;
  activeIndex: number;
  onSelect: (index: number) => void;
  enriching: boolean;
  inDock?: boolean;
}) {
  const images = resolveImages(vm);
  if (images.length <= 1) {
    if (!enriching) return null;
    return (
      <div
        className={cn(
          "h-12 animate-pulse rounded-md bg-surface-container-high motion-reduce:animate-none",
          inDock ? "mx-3 mb-2" : "mt-3",
        )}
        aria-hidden
      />
    );
  }

  return (
    <ul
      className={cn(
        "flex list-none gap-2 overflow-x-auto px-3 pb-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-reduce:animate-none",
        inDock ? "pt-2" : "mt-3 pb-1",
      )}
    >
      {images.map((src, index) => (
        <li key={src} className="shrink-0">
          <button
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "relative size-12 overflow-hidden rounded-md border-2 transition-all motion-safe:duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              index === activeIndex
                ? "scale-100 border-primary"
                : "scale-95 border-transparent opacity-70 hover:scale-100 hover:opacity-100",
            )}
            aria-label={`Show image ${index + 1}`}
            aria-current={index === activeIndex ? "true" : undefined}
          >
            <MediaImage
              src={src}
              alt=""
              label="Lot artwork thumbnail"
              className="size-full"
              imgClassName="size-full object-cover"
              sizes="48px"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function QuickLookBody({
  vm,
  enriching,
  deckDirection,
  imageIndex,
  onImageIndexChange,
  onHeroClick,
  deckNav,
}: {
  vm: LotQuickLookVM;
  enriching: boolean;
  deckDirection: DeckDirection;
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  onHeroClick: () => void;
  deckNav?: ReactNode;
}) {
  const touchStartX = useRef<number | null>(null);
  const images = resolveImages(vm);
  const heroSrc = images[imageIndex] ?? vm.imageUrl;
  const showGalleryDock = images.length > 1 || enriching;

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null || images.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0 && imageIndex < images.length - 1) onImageIndexChange(imageIndex + 1);
    if (delta > 0 && imageIndex > 0) onImageIndexChange(imageIndex - 1);
  }

  return (
    <div
      className={cn(
        "grid min-h-0 shrink-0 bg-surface-container-low lg:min-h-0 lg:flex-1",
        showGalleryDock ? "grid-rows-[minmax(0,1fr)_auto]" : "grid-rows-[minmax(0,1fr)]",
        deckEnterClass(deckDirection),
      )}
    >
      <div
        className="relative min-h-0 w-full overflow-hidden h-[50dvh] max-h-[58dvh] sm:aspect-square sm:h-auto sm:max-h-[50vh] lg:min-h-[22rem] lg:h-auto lg:max-h-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {deckNav}
        <button
          type="button"
          onClick={onHeroClick}
          className="absolute inset-0 size-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Expand image for ${vm.title}`}
        >
          <MediaImage
            key={`${vm.id}-${heroSrc ?? "empty"}`}
            src={heroSrc}
            alt={vm.imageAlt}
            label="Lot artwork"
            className="pointer-events-none absolute inset-0 size-full"
            imgClassName="size-full object-contain motion-safe:transition-opacity motion-safe:duration-300"
            sizes="(max-width: 640px) 100vw, 480px"
            priority
          />
        </button>
      </div>

      {showGalleryDock ? (
        <div className="isolate flex shrink-0 flex-col border-t border-outline-variant/20 bg-surface-container-lowest">
          {images.length > 1 ? (
            <div className="flex h-9 shrink-0 items-center justify-end border-b border-outline-variant/10 px-3">
              <span
                className="inline-flex min-w-[3.25rem] items-center justify-center rounded-full bg-surface-container-high px-2.5 py-0.5 font-body text-xs font-medium tabular-nums text-on-surface"
                aria-live="polite"
                aria-atomic="true"
              >
                {imageIndex + 1} / {images.length}
              </span>
            </div>
          ) : null}
          <QuickLookImageStrip
            vm={vm}
            activeIndex={imageIndex}
            onSelect={onImageIndexChange}
            enriching={enriching}
            inDock
          />
        </div>
      ) : null}
    </div>
  );
}

function preloadImage(url: string): void {
  const img = new Image();
  img.src = url;
}

export function LotQuickLookDialog() {
  const { session, open, closeQuickLook, setDeckIndex, returnFocusRef } = useLotQuickLook();
  const reduceMotion = useReducedMotion();
  const [displayVm, setDisplayVm] = useState<LotQuickLookVM | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [deckDirection, setDeckDirection] = useState<DeckDirection>(null);
  const [enrichmentAnnounce, setEnrichmentAnnounce] = useState("");
  const [deckAnnounce, setDeckAnnounce] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeVm = session?.vm;

  useEffect(() => {
    if (!activeVm) {
      setDisplayVm(null);
      return;
    }
    setDisplayVm(activeVm);
    setImageIndex(0);
    setLightboxOpen(false);
    emitQuickLookOpen(activeVm.id, session?.options.deckSourceLabel);
    recordRecentlyViewedLot({
      id: activeVm.id,
      href: activeVm.href,
      title: activeVm.title,
    });

    let cancelled = false;
    setEnriching(true);
    setEnrichmentAnnounce("");
    const started = performance.now();
    void fetchLotQuickLookEnrichment(activeVm.id).then((enrichment) => {
      if (cancelled) return;
      setDisplayVm((prev) => (prev ? mergeLotQuickLookEnrichment(prev, enrichment) : prev));
      setEnriching(false);
      trackQuickLookEnrichmentMs({
        lotId: activeVm.id,
        ms: Math.round(performance.now() - started),
      });
      if (enrichment?.medium || enrichment?.images?.length) {
        setEnrichmentAnnounce("Additional lot details loaded.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeVm, session?.options.deckSourceLabel]);

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
  const images = vm ? resolveImages(vm) : [];
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
      if (src) preloadImage(src);
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
  const loginNextPath = options.loginNextPath ?? vm.href;
  const showBid = isLotQuickLookBiddable(vm.status);
  const bidHref = `${vm.href}#bid-interactive-anchor`;
  const contextLabel =
    options.deckSourceLabel ??
    (deckLength > 1 ? `Quick look · ${deckIndex + 1} of ${deckLength}` : "Quick look");
  const contextId = "quick-look-context";
  const statusId = "quick-look-status";
  const shareBase = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareUrl = vm.href.startsWith("http")
    ? vm.href
    : `${shareBase.replace(/\/$/, "")}${vm.href}`;

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

        <div
          key={`meta-${vm.id}`}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-2 sm:p-6",
            deckEnterClass(deckDirection),
          )}
        >
          <div className="quick-look-stagger flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                id={contextId}
                className="font-body text-xs font-medium uppercase tracking-wide text-on-surface-variant"
              >
                {contextLabel}
              </p>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="font-body text-xs text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Back to results
              </button>
            </div>

            <QuickLookStatusBand vm={vm} statusId={statusId} />

            <div className="space-y-1">
              <h2
                className="line-clamp-2 text-left font-headline text-xl font-semibold leading-snug text-on-surface sm:text-2xl"
                aria-describedby={`${contextId} ${statusId}`}
              >
                {vm.title}
              </h2>
              <p className="line-clamp-1 text-left font-body text-sm text-on-surface-variant">
                {vm.subtitle}
              </p>
            </div>

            {vm.medium ? (
              <p className="line-clamp-2 font-body text-sm text-on-surface-variant">{vm.medium}</p>
            ) : enriching ? (
              <div
                className="h-4 w-2/3 animate-pulse rounded bg-surface-container-high motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}

            {vm.dimensions ? (
              <p className="font-body text-sm text-on-surface-variant">{vm.dimensions}</p>
            ) : null}

            <QuickLookPricingCards vm={vm} />

            {vm.buyersPremiumHint ? (
              <p className="font-body text-xs text-on-surface-variant">{vm.buyersPremiumHint}</p>
            ) : null}

            {deckLength > 1 ? (
              <LotQuickLookDeckNav
                className="lg:hidden"
                deckIndex={deckIndex}
                deckLength={deckLength}
                onPrev={goDeckPrev}
                onNext={goDeckNext}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex shrink-0 flex-col gap-3 border-t border-outline-variant/20 bg-surface-container-lowest p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <MarketingWatchlistHeart
            lotId={vm.id}
            lotTitle={vm.title}
            initialWatching={options.watchedLotIds.includes(vm.id)}
            isAuthenticated={options.isAuthenticated}
            loginNextPath={loginNextPath}
            layout="inline"
          />
          <ShareButton url={shareUrl} title={vm.title} className="min-h-10" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {showBid ? (
            <Button asChild className="h-11 min-h-11 w-full sm:w-auto">
              <Link
                href={bidHref}
                onClick={() => {
                  emitQuickLookCta(vm.id, "bid");
                  handleCtaNavigate();
                }}
              >
                Bid
              </Link>
            </Button>
          ) : null}
          <Button
            variant={showBid ? "outline" : "default"}
            asChild
            className="h-11 min-h-11 w-full sm:w-auto"
          >
            <Link
              href={vm.href}
              onClick={() => {
                emitQuickLookCta(vm.id, "view_lot");
                handleCtaNavigate();
              }}
            >
              View lot
            </Link>
          </Button>
        </div>
      </div>

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
