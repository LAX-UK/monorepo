"use client";

import { useCallback, useEffect, useRef } from "react";

const HOVER_OPEN_MS = 80;
const HOVER_CLOSE_MS = 160;

export function useMegaMenuHoverIntent(
  setOpenIndex: (index: number | null) => void,
  finePointerHover: boolean,
) {
  const openHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenHover = useCallback(() => {
    if (openHoverTimeoutRef.current) {
      clearTimeout(openHoverTimeoutRef.current);
      openHoverTimeoutRef.current = null;
    }
  }, []);

  const clearCloseHover = useCallback(() => {
    if (closeHoverTimeoutRef.current) {
      clearTimeout(closeHoverTimeoutRef.current);
      closeHoverTimeoutRef.current = null;
    }
  }, []);

  const scheduleOpenHover = useCallback(
    (index: number) => {
      clearCloseHover();
      clearOpenHover();
      openHoverTimeoutRef.current = setTimeout(() => {
        setOpenIndex(index);
        openHoverTimeoutRef.current = null;
      }, HOVER_OPEN_MS);
    },
    [clearCloseHover, clearOpenHover, setOpenIndex],
  );

  const scheduleCloseHover = useCallback(() => {
    clearOpenHover();
    clearCloseHover();
    closeHoverTimeoutRef.current = setTimeout(() => {
      setOpenIndex(null);
      closeHoverTimeoutRef.current = null;
    }, HOVER_CLOSE_MS);
  }, [clearCloseHover, clearOpenHover, setOpenIndex]);

  const clearAllHover = useCallback(() => {
    clearOpenHover();
    clearCloseHover();
  }, [clearCloseHover, clearOpenHover]);

  useEffect(() => {
    return () => {
      clearOpenHover();
      clearCloseHover();
    };
  }, [clearCloseHover, clearOpenHover]);

  const onRootMouseEnter = useCallback(() => {
    if (finePointerHover) clearCloseHover();
  }, [clearCloseHover, finePointerHover]);

  const onRootMouseLeave = useCallback(() => {
    if (finePointerHover) scheduleCloseHover();
  }, [finePointerHover, scheduleCloseHover]);

  return {
    scheduleOpenHover,
    scheduleCloseHover,
    clearAllHover,
    onRootMouseEnter,
    onRootMouseLeave,
  };
}
