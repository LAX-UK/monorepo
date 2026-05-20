import type { CarouselApi } from "@auction/ui";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGalleryCarouselApi } from "./use-gallery-carousel";

function createMockApi(initial = 0, count = 3): NonNullable<CarouselApi> {
  let index = initial;
  const listeners = new Map<string, Set<() => void>>();

  const emit = (event: string) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const cb of set) cb();
  };

  return {
    selectedScrollSnap: () => index,
    scrollSnapList: () => Array.from({ length: count }, (_, i) => i),
    scrollTo: (i: number) => {
      index = i;
      emit("select");
    },
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: (event: string, cb: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(cb);
    },
    off: (event: string, cb: () => void) => {
      listeners.get(event)?.delete(cb);
    },
  } as unknown as NonNullable<CarouselApi>;
}

describe("useGalleryCarouselApi", () => {
  it("syncs index from the carousel api", () => {
    const api = createMockApi(0, 4);
    const { result } = renderHook(() => useGalleryCarouselApi(api));

    expect(result.current.index).toBe(0);
    expect(result.current.count).toBe(4);

    act(() => {
      api.scrollTo(2);
    });

    expect(result.current.index).toBe(2);
  });

  it("scrollTo delegates to the api", () => {
    const api = createMockApi(0, 3);
    const { result } = renderHook(() => useGalleryCarouselApi(api));

    act(() => {
      result.current.scrollTo(1);
    });

    expect(result.current.index).toBe(1);
  });

  it("on() returns an unsubscribe function", () => {
    const api = createMockApi();
    const { result } = renderHook(() => useGalleryCarouselApi(api));
    const cb = vi.fn();

    let unsub: () => void = () => undefined;
    act(() => {
      unsub = result.current.on("select", cb);
    });

    act(() => {
      api.scrollTo(1);
    });
    expect(cb).toHaveBeenCalled();

    act(() => {
      unsub();
      api.scrollTo(2);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
