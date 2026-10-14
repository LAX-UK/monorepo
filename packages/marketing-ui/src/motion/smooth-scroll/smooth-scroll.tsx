"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { SmoothScrollEngine, SmoothScrollEngineFactory } from "./engine.js";
import { createLenisEngine } from "./lenis-engine.js";
import { createNativeEngine } from "./native-engine.js";
import { observeScrollLock } from "./scroll-lock.js";
import { SmoothScrollProvider } from "./smooth-scroll-context.js";

type SmoothScrollProps = {
  children: ReactNode;
  createEngine?: SmoothScrollEngineFactory;
  /** App-level reduced-motion preference (e.g. an in-app override); defaults to the OS media query. */
  reducedMotion?: boolean;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function SmoothScroll({
  children,
  createEngine = createLenisEngine,
  reducedMotion: reducedMotionOverride,
}: SmoothScrollProps) {
  const osReducedMotion = usePrefersReducedMotion();
  const reducedMotion = reducedMotionOverride ?? osReducedMotion;
  const pathname = usePathname();
  const engineRef = useRef<SmoothScrollEngine | null>(null);
  const factory = reducedMotion ? createNativeEngine : createEngine;

  useEffect(() => {
    const engine = factory();
    engineRef.current = engine;
    const unsubscribeLock = observeScrollLock((locked) => {
      if (locked) engine.stop();
      else engine.start();
    });
    return () => {
      unsubscribeLock();
      engine.destroy();
      engineRef.current = null;
    };
  }, [factory]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || pathname === null) return;
    const id = requestAnimationFrame(() => engine.sync());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  const contextValue = useMemo(
    () => ({
      scrollTo: (
        target: Parameters<SmoothScrollEngine["scrollTo"]>[0],
        options?: Parameters<SmoothScrollEngine["scrollTo"]>[1],
      ) =>
        engineRef.current?.scrollTo(target, options) ??
        createNativeEngine().scrollTo(target, options),
    }),
    [],
  );

  return <SmoothScrollProvider value={contextValue}>{children}</SmoothScrollProvider>;
}
