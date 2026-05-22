"use client";

import { extractRegionPixels } from "@/lib/media/extract-region-pixels";
import { recordCacheHit, recordOpaqueFallback, recordSample } from "@/lib/media/overlay-tone-stats";
import type {
  NormalizedRect,
  ObjectFitMode,
  OverlayToneResult,
  SlotName,
} from "@/lib/media/overlay-tone-types";
import type { FixedSlotDef, OverlaySlotDef } from "@/lib/media/overlay-tone-types";
import { defaultTaintedResult, pickOverlayToneFromRegion } from "@/lib/media/pick-overlay-tone";
import {
  isMaterialBoundsChange,
  isMaterialRectChange,
  projectSlotToImageSpace,
  serializeRect,
  visibleImageBoundsPx,
} from "@/lib/media/project-slot";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_OVERLAY_TONE: OverlayToneResult = {
  kind: "frosted",
  tone: "light",
  contrast: 0,
};

export type ContentBlockSlot = { name: "contentBlock"; type: FixedSlotDef["type"] };

export type { OverlaySlotDef };

type ToneMap = Partial<Record<SlotName, OverlayToneResult>>;

type UseImageOverlayTonesOptions = {
  src: string | null | undefined;
  objectFit: ObjectFitMode;
  slots: OverlaySlotDef[];
  containerRef: RefObject<HTMLElement | null>;
  imageRef: RefObject<HTMLImageElement | null>;
  enabled?: boolean;
  /** Increment when the underlying image finishes loading to trigger sampling. */
  imageLoadTick?: number;
};

const pixelCache = new Map<string, ReturnType<typeof extractRegionPixels>>();

function scheduleIdle(cb: () => void): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(cb, { timeout: 500 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 0);
  return () => clearTimeout(id);
}

function containerSpaceRect(element: HTMLElement, container: HTMLElement): NormalizedRect | null {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) return null;

  return {
    x: (elementRect.left - containerRect.left) / containerRect.width,
    y: (elementRect.top - containerRect.top) / containerRect.height,
    w: elementRect.width / containerRect.width,
    h: elementRect.height / containerRect.height,
  };
}

function resolveSlotTone(
  slot: OverlaySlotDef,
  slotRect: NormalizedRect,
  containerWidth: number,
  containerHeight: number,
  img: HTMLImageElement,
  objectFit: ObjectFitMode,
  previous?: OverlayToneResult,
  previousRect?: NormalizedRect,
  boundsChanged = false,
): OverlayToneResult {
  if (previous && previousRect && !boundsChanged && !isMaterialRectChange(previousRect, slotRect)) {
    return previous;
  }

  const projected = projectSlotToImageSpace(
    slotRect,
    { width: containerWidth, height: containerHeight },
    { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight },
    objectFit,
  );

  if (projected.kind === "opaque") {
    recordOpaqueFallback();
    return { kind: "opaque", tone: projected.tone, contrast: 0 };
  }

  const cacheKey = `${img.currentSrc || img.src}|${serializeRect(projected.rect)}`;
  let pixels = pixelCache.get(cacheKey);
  if (!pixels) {
    pixels = extractRegionPixels(img, projected.rect);
    pixelCache.set(cacheKey, pixels);
    recordSample();
  } else {
    recordCacheHit();
  }

  if ("error" in pixels) {
    recordOpaqueFallback();
    return defaultTaintedResult();
  }

  const result = pickOverlayToneFromRegion(pixels, slot.type);
  if (result.kind === "opaque") recordOpaqueFallback();
  return result;
}

/** Client hook: sample image regions and resolve per-slot overlay tones. */
export function useImageOverlayTones({
  src,
  objectFit,
  slots,
  containerRef,
  imageRef,
  enabled = true,
  imageLoadTick = 0,
}: UseImageOverlayTonesOptions): { tones: ToneMap; resolved: boolean } {
  const [tones, setTones] = useState<ToneMap>({});
  const [resolved, setResolved] = useState(false);
  const boundsRef = useRef<ReturnType<typeof visibleImageBoundsPx> | null>(null);
  const rectCacheRef = useRef<Map<SlotName, NormalizedRect>>(new Map());
  const toneCacheRef = useRef<Map<SlotName, OverlayToneResult>>(new Map());
  const inViewRef = useRef(false);

  const sampleAll = useCallback(() => {
    const container = containerRef.current;
    const img = imageRef.current;
    if (!enabled || !container || !img || !src || img.naturalWidth <= 0) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const bounds = visibleImageBoundsPx(
      { width: containerWidth, height: containerHeight },
      { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight },
      objectFit,
    );
    const boundsChanged =
      boundsRef.current != null && isMaterialBoundsChange(boundsRef.current, bounds);

    const next: ToneMap = {};

    for (const slot of slots) {
      let slotRect: NormalizedRect | null = null;

      if (slot.name === "contentBlock") {
        const block = container.querySelector<HTMLElement>("[data-overlay-content-block]");
        if (block) slotRect = containerSpaceRect(block, container);
      } else {
        slotRect = slot.rect;
      }

      if (!slotRect) continue;

      const prevRect = rectCacheRef.current.get(slot.name);
      const prevTone = toneCacheRef.current.get(slot.name);

      const tone = resolveSlotTone(
        slot,
        slotRect,
        containerWidth,
        containerHeight,
        img,
        objectFit,
        prevTone,
        prevRect,
        boundsChanged,
      );

      next[slot.name] = tone;
      rectCacheRef.current.set(slot.name, slotRect);
      toneCacheRef.current.set(slot.name, tone);
    }

    boundsRef.current = bounds;
    setTones(next);
    setResolved(true);
  }, [containerRef, enabled, imageRef, objectFit, slots, src]);

  const queueSample = useCallback(() => {
    if (!inViewRef.current) return;
    return scheduleIdle(sampleAll);
  }, [sampleAll]);

  useEffect(() => {
    if (!enabled) return;
    rectCacheRef.current.clear();
    toneCacheRef.current.clear();
    boundsRef.current = null;
    setTones({});
    setResolved(false);

    for (const key of [...pixelCache.keys()]) {
      if (src && key.startsWith(`${src}|`)) pixelCache.delete(key);
    }
  }, [enabled, src]);

  useEffect(() => {
    if (!enabled || imageLoadTick <= 0) return;
    return queueSample();
  }, [enabled, imageLoadTick, queueSample]);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries.some((e) => e.isIntersecting);
        if (inViewRef.current) queueSample();
      },
      { rootMargin: "100px" },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, enabled, queueSample]);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const frameObserver = new ResizeObserver(() => {
      queueSample();
    });
    frameObserver.observe(containerRef.current);

    const block = containerRef.current.querySelector("[data-overlay-content-block]");
    const blockObserver = block ? new ResizeObserver(() => queueSample()) : null;
    if (block && blockObserver) blockObserver.observe(block);

    return () => {
      frameObserver.disconnect();
      blockObserver?.disconnect();
    };
  }, [containerRef, enabled, queueSample]);

  return { tones, resolved };
}

/** Test helper — clear module pixel cache between tests. */
export function clearOverlayPixelCacheForTests(): void {
  pixelCache.clear();
}
