"use client";

import {
  type CountdownContext,
  type CountdownDisplay,
  type CountdownSurface,
  countdownDisplay,
} from "@auction/domain";
import {
  type UseCountdownOptions,
  createCountdownHook,
  useClockTick,
  useClockNow as useSharedClockNow,
} from "@auction/ui/clock";
import { type RefObject, useEffect } from "react";
import { ensureServerClockSync } from "./browser-clock-sync.client";

/** A wake this close means seconds are on screen, where a clock a second out shows. */
const SECONDS_ON_SCREEN_MS = 1_500;

/**
 * Starts measuring the server's clock the first time seconds are on screen. A page that only
 * shows days and hours never calls the Bid API for the time.
 */
function ensureSyncForWake(waitMs: number | null): void {
  if (waitMs !== null && waitMs <= SECONDS_ON_SCREEN_MS) ensureServerClockSync();
}

const useSharedCountdown = createCountdownHook<
  CountdownSurface,
  CountdownDisplay,
  CountdownContext
>(countdownDisplay);

/**
 * What a surface shows for the time left until `targetMs` (server time), from the one countdown
 * rule. `null` on the server and for the first client render: print your placeholder then. Pass a
 * module-level constant as `options.ctx`.
 */
export function useCountdown(
  targetMs: number,
  surface: CountdownSurface,
  options?: UseCountdownOptions<CountdownContext>,
): CountdownDisplay | null {
  const display = useSharedCountdown(targetMs, surface, options);
  const wait =
    display && "nextChangeInMs" in display && typeof display.nextChangeInMs === "number"
      ? display.nextChangeInMs
      : null;
  useEffect(() => {
    ensureSyncForWake(wait);
  }, [wait]);
  return display;
}

/**
 * The server-aligned time, stepping every `resolutionMs`, for components that decide something
 * from the time itself. `null` on the server and for the first client render.
 */
export function useClockNow(
  resolutionMs = 1000,
  options: { inViewRef?: RefObject<Element | null> | undefined } = {},
): number | null {
  useEffect(() => {
    ensureSyncForWake(resolutionMs);
  }, [resolutionMs]);
  return useSharedClockNow(resolutionMs, options);
}

/** Milliseconds until a countdown to `msLeft` next prints differently, or null when it never will. */
export function wakeForCountdown(surface: CountdownSurface, msLeft: number): number | null {
  const display = countdownDisplay(surface, msLeft);
  return "nextChangeInMs" in display ? display.nextChangeInMs : null;
}

/**
 * The server-aligned time as of the last moment any of `moments` (times a lot opens or closes,
 * in epoch milliseconds) changes what `surface` prints. The component works out its own text
 * from the returned time and re-renders only when that text can change: once a minute while only
 * minutes show, once a second in the final hour, and when a moment passes. `null` on the server
 * and for the first client render.
 */
export function useCountdownTick(
  moments: readonly (number | null)[],
  options: {
    surface: CountdownSurface;
    inViewRef?: RefObject<Element | null> | undefined;
  },
): number | null {
  return useClockTick(
    (now) => {
      let soonest: number | null = null;
      for (const moment of moments) {
        if (moment === null || !Number.isFinite(moment) || moment <= now) continue;
        const wait = wakeForCountdown(options.surface, moment - now);
        if (wait !== null && (soonest === null || wait < soonest)) soonest = wait;
      }
      ensureSyncForWake(soonest);
      return soonest;
    },
    {
      key: `${options.surface}:${moments.join("|")}`,
      inViewRef: options.inViewRef,
    },
  );
}
