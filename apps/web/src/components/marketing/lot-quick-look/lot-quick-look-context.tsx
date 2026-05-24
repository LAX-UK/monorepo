"use client";

import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LotQuickLookOpenOptions, LotQuickLookSession, LotQuickLookVM } from "./types";

type LotQuickLookContextValue = {
  session: LotQuickLookSession | null;
  open: boolean;
  openQuickLook: (
    vm: LotQuickLookVM,
    options: LotQuickLookOpenOptions,
    returnFocusRef?: RefObject<HTMLElement | null>,
  ) => void;
  closeQuickLook: () => void;
  setDeckIndex: (index: number) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

const LotQuickLookContext = createContext<LotQuickLookContextValue | null>(null);

function resolveDeckVm(
  options: LotQuickLookOpenOptions,
  deckIndex: number,
  fallback: LotQuickLookVM,
): LotQuickLookVM {
  const deck = options.deck;
  if (!deck?.length) return fallback;
  const clamped = Math.max(0, Math.min(deckIndex, deck.length - 1));
  return deck[clamped] ?? fallback;
}

export function LotQuickLookProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<LotQuickLookSession | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openQuickLook = useCallback(
    (
      vm: LotQuickLookVM,
      options: LotQuickLookOpenOptions,
      triggerRef?: RefObject<HTMLElement | null>,
    ) => {
      returnFocusRef.current = triggerRef?.current ?? null;
      const deckIndex = options.deckIndex ?? 0;
      setSession({
        vm: resolveDeckVm(options, deckIndex, vm),
        options,
        deckIndex,
      });
      setOpen(true);
    },
    [],
  );

  const closeQuickLook = useCallback(() => {
    setOpen(false);
  }, []);

  const setDeckIndex = useCallback((index: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const vm = resolveDeckVm(prev.options, index, prev.vm);
      return { ...prev, deckIndex: index, vm };
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      open,
      openQuickLook,
      closeQuickLook,
      setDeckIndex,
      returnFocusRef,
    }),
    [session, open, openQuickLook, closeQuickLook, setDeckIndex],
  );

  return <LotQuickLookContext.Provider value={value}>{children}</LotQuickLookContext.Provider>;
}

export function useLotQuickLook(): LotQuickLookContextValue {
  const ctx = useContext(LotQuickLookContext);
  if (!ctx) {
    throw new Error("useLotQuickLook must be used within LotQuickLookProvider");
  }
  return ctx;
}

/** Safe hook for optional provider (returns null outside marketing shell). */
export function useLotQuickLookOptional(): LotQuickLookContextValue | null {
  return useContext(LotQuickLookContext);
}
