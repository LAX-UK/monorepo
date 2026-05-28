import {
  useSplitOverlayOpen,
  useSplitOverlayOpenLg,
  useSplitOverlayOpenSm,
} from "@/hooks/use-split-overlay-open";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-is-md", () => ({
  useIsMd: vi.fn(() => false),
}));

vi.mock("@/hooks/use-is-lg", () => ({
  useIsLg: vi.fn(() => false),
}));

vi.mock("@/hooks/use-is-sm", () => ({
  useIsSm: vi.fn(() => false),
}));

describe("useSplitOverlayOpen", () => {
  it("routes open state to mobile root below md", () => {
    const { result } = renderHook(() => useSplitOverlayOpen(true, vi.fn()));
    expect(result.current.mobile.open).toBe(true);
    expect(result.current.desktop.open).toBe(false);
  });
});

describe("useSplitOverlayOpenLg", () => {
  it("routes open state to mobile root below lg", () => {
    const { result } = renderHook(() => useSplitOverlayOpenLg(true, vi.fn()));
    expect(result.current.mobile.open).toBe(true);
    expect(result.current.desktop.open).toBe(false);
  });
});

describe("useSplitOverlayOpenSm", () => {
  it("routes open state to mobile root below sm", () => {
    const { result } = renderHook(() => useSplitOverlayOpenSm(true, vi.fn()));
    expect(result.current.mobile.open).toBe(true);
    expect(result.current.desktop.open).toBe(false);
  });
});

describe("useSplitOverlayOpenSm", () => {
  it("routes open state to mobile root below sm", () => {
    const { result } = renderHook(() => useSplitOverlayOpenSm(true, vi.fn()));
    expect(result.current.mobile.open).toBe(true);
    expect(result.current.desktop.open).toBe(false);
  });
});
