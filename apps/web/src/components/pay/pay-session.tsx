"use client";

import { type PayMethod, type PayMethodsVm, usableMethod } from "@/lib/pay/pay-methods";
import type { PayAction } from "@/lib/pay/pay-page.vm";
import { payAction } from "@/lib/pay/pay.actions";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

/** What the last attempt to pay left the person to read. */
export type PayFeedback = { tone: "warning" | "danger"; message: string };

/** How long the secure payment page may take to open before the person is told and can retry. */
export const OPEN_TIMEOUT_MS = 8_000;

type PayNowAction = Extract<PayAction, { kind: "pay" }>;

type PaySession = {
  /** The payment is being opened: the buttons show it and ignore a second press. */
  pending: boolean;
  /** The secure payment page did not open in time. Nothing was charged. */
  openTimedOut: boolean;
  feedback: PayFeedback | null;
  /** How the person chose to pay; the action says what it will do for it. */
  method: PayMethod;
  chooseMethod: (method: PayMethod) => void;
  pay: (action: PayNowAction) => void;
  /** Tries the same payment again after it failed to open. */
  retry: () => void;
};

const PaySessionContext = createContext<PaySession | null>(null);

const STORAGE_PREFIX = "pay-method:";

function remembered(key: string): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function remember(key: string, method: PayMethod): void {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, method);
  } catch {
    // Not remembered; the choice still holds for this visit.
  }
}

/**
 * Starts the payment for the rail and the phone bar alike, so both are one action with one
 * state. It sends only the lots, the total that were shown and the method chosen. When the server
 * says the plan changed, nothing was charged: the page is read again and the new total is
 * announced to check. A payment page that has not opened after eight seconds is reported with a
 * way to try again. The method chosen survives the trip to the payment page and back.
 */
export function PaySessionProvider({
  methods,
  storageKey,
  children,
}: {
  methods: PayMethodsVm | null;
  /** Identifies this payment (its lots), so a remembered method is never used for another. */
  storageKey: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [opening, setOpening] = useState(false);
  const [openTimedOut, setOpenTimedOut] = useState(false);
  const [feedback, setFeedback] = useState<PayFeedback | null>(null);
  const [method, setMethod] = useState<PayMethod>(methods?.defaultMethod ?? "card");
  const lastAction = useRef<PayNowAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the newest attempt may move the page: an earlier one that answers late is ignored.
  const attempts = useRef(0);

  // Coming back to this page from the payment page must not stay "opening", and the method the
  // person chose before leaving is chosen again (if the server still allows it).
  useEffect(() => {
    if (methods) setMethod(usableMethod(methods, remembered(storageKey)));
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setOpening(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, [methods, storageKey]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const chooseMethod = useCallback(
    (next: PayMethod) => {
      setMethod(next);
      remember(storageKey, next);
    },
    [storageKey],
  );

  const pay = useCallback(
    (action: PayNowAction) => {
      lastAction.current = action;
      attempts.current += 1;
      const attempt = attempts.current;
      setFeedback(null);
      setOpenTimedOut(false);
      setOpening(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpenTimedOut(true), OPEN_TIMEOUT_MS);
      startTransition(async () => {
        const result = await payAction({
          lotIds: action.lotIds,
          expectedTotalPence: action.expectedTotalPence,
          method,
        });
        if (attempt !== attempts.current) return;
        if (timer.current) clearTimeout(timer.current);
        if (result.kind === "redirect") {
          // Stays "opening" until the browser leaves for the payment page.
          setOpenTimedOut(false);
          window.location.assign(result.url);
          return;
        }
        setOpening(false);
        setOpenTimedOut(false);
        if (result.kind === "changed") {
          setFeedback({ tone: "warning", message: result.message });
          router.refresh();
          return;
        }
        setFeedback({ tone: "danger", message: result.message });
        if (result.refresh) router.refresh();
      });
    },
    [method, router],
  );

  const retry = useCallback(() => {
    if (lastAction.current) pay(lastAction.current);
  }, [pay]);

  const value = useMemo<PaySession>(
    () => ({
      pending: opening || isPending,
      openTimedOut,
      feedback,
      method,
      chooseMethod,
      pay,
      retry,
    }),
    [opening, isPending, openTimedOut, feedback, method, chooseMethod, pay, retry],
  );
  return <PaySessionContext.Provider value={value}>{children}</PaySessionContext.Provider>;
}

export function usePaySession(): PaySession {
  const session = useContext(PaySessionContext);
  if (!session) throw new Error("usePaySession must be used within PaySessionProvider");
  return session;
}
