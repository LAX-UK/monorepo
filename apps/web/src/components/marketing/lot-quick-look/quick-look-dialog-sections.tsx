import { LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { ReactNode, TouchEvent } from "react";
import { useRef } from "react";
import { LotQuickLookDeckNav } from "./lot-quick-look-deck-nav";
import {
  type DeckDirection,
  deckEnterClass,
  resolveQuickLookImages,
} from "./quick-look-dialog-utils";
import type { LotQuickLookVM } from "./types";

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

export function QuickLookPricingCards({ vm }: { vm: LotQuickLookVM }) {
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
  const images = resolveQuickLookImages(vm);
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelect(index)}
            className={cn(
              "relative h-auto min-h-0 size-12 overflow-hidden rounded-md border-2 p-0 font-normal transition-all motion-safe:duration-200 focus-visible:border-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 focus-visible:ring-offset-0",
              index === activeIndex
                ? "scale-100 border-primary hover:bg-transparent"
                : "scale-95 border-transparent opacity-70 hover:scale-100 hover:opacity-100 hover:bg-transparent",
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
          </Button>
        </li>
      ))}
    </ul>
  );
}

type QuickLookBodyProps = {
  vm: LotQuickLookVM;
  enriching: boolean;
  deckDirection: DeckDirection;
  imageIndex: number;
  onImageIndexChange: (index: number) => void;
  onHeroClick: () => void;
  deckNav?: ReactNode;
};

export function QuickLookBody({
  vm,
  enriching,
  deckDirection,
  imageIndex,
  onImageIndexChange,
  onHeroClick,
  deckNav,
}: QuickLookBodyProps) {
  const touchStartX = useRef<number | null>(null);
  const images = resolveQuickLookImages(vm);
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
        <Button
          type="button"
          variant="ghost"
          onClick={onHeroClick}
          className="absolute inset-0 z-0 h-full min-h-0 w-full cursor-zoom-in rounded-none border-0 p-0 hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 focus-visible:ring-offset-0"
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
        </Button>
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

type QuickLookMetaPanelProps = {
  vm: LotQuickLookVM;
  enriching: boolean;
  deckDirection: DeckDirection;
  contextLabel: string;
  contextId: string;
  statusId: string;
  deckIndex: number;
  deckLength: number;
  onClose: () => void;
  onDeckPrev: () => void;
  onDeckNext: () => void;
};

export function QuickLookMetaPanel({
  vm,
  enriching,
  deckDirection,
  contextLabel,
  contextId,
  statusId,
  deckIndex,
  deckLength,
  onClose,
  onDeckPrev,
  onDeckNext,
}: QuickLookMetaPanelProps) {
  return (
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
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 rounded-none px-0 font-body text-xs font-normal text-link underline-offset-2 hover:bg-transparent hover:text-link hover:underline focus-visible:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={onClose}
          >
            Back to results
          </Button>
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
            onPrev={onDeckPrev}
            onNext={onDeckNext}
          />
        ) : null}
      </div>
    </div>
  );
}
