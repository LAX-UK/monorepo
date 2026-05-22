"use client";

import { DEFAULT_OVERLAY_TONE, type OverlaySlotDef } from "@/hooks/use-image-overlay-tones";
import type { OverlayToneResult, SlotName } from "@/lib/media/overlay-tone-types";
import { type ReactNode, createContext, useContext } from "react";

type OverlayToneContextValue = {
  tones: Partial<Record<SlotName, OverlayToneResult>>;
  resolved: boolean;
};

const OverlayToneContext = createContext<OverlayToneContextValue | null>(null);

export function OverlayToneProvider({
  value,
  children,
}: {
  value: OverlayToneContextValue;
  children: ReactNode;
}) {
  return <OverlayToneContext.Provider value={value}>{children}</OverlayToneContext.Provider>;
}

export function useOverlayTone(slot: SlotName): OverlayToneResult {
  const ctx = useContext(OverlayToneContext);
  return ctx?.tones[slot] ?? DEFAULT_OVERLAY_TONE;
}

export function useOverlayToneContext(): OverlayToneContextValue | null {
  return useContext(OverlayToneContext);
}

export type { OverlaySlotDef, OverlayToneContextValue };
