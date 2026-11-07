"use client";

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
  useState,
  useTransition,
} from "react";

/** What the last attempt to pay left the person to read. */
export type PayFeedback = { tone: "warning" | "danger"; message: string; detail?: string };

type PaySession = {
  /** The payment is being opened: the buttons show it and ignore a second press. */
  pending: boolean;
  feedback: PayFeedback | null;
  pay: (action: Extract<PayAction, { kind: "pay" }>) => void;
};

const PaySessionContext = createContext<PaySession | null>(null);

/**
 * Starts the payment for the rail and the phone bar alike, so both are one action with one
 * state. It sends only the lots and the total that were shown. When the server says the plan
 * changed, nothing was charged: the page is read again and the new total is announced to check.
 */
export function PaySessionProvider({
  children,
  returned,
}: {
  children: ReactNode;
  /** The payment page sent the person back without paying (see `PayPageVm.returned`). */
  returned: { title: string; detail: string; cleanHref: string } | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [opening, setOpening] = useState(false);
  const [feedback, setFeedback] = useState<PayFeedback | null>(
    returned ? { tone: "danger", message: returned.title, detail: returned.detail } : null,
  );

  // The note is shown once: take it out of the address, so a refresh or a changed plan later does
  // not show it again. The note stays on screen (it is state, not the URL).
  const cleanHref = returned?.cleanHref ?? null;
  useEffect(() => {
    if (cleanHref) router.replace(cleanHref, { scroll: false });
  }, [cleanHref, router]);

  // Coming back to this page from the payment page (the back button) must not stay "opening".
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setOpening(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const pay = useCallback(
    (action: Extract<PayAction, { kind: "pay" }>) => {
      setFeedback(null);
      setOpening(true);
      startTransition(async () => {
        const result = await payAction({
          lotIds: action.lotIds,
          expectedTotalPence: action.expectedTotalPence,
        });
        if (result.kind === "redirect") {
          // Stays "opening" until the browser leaves for the payment page.
          window.location.assign(result.url);
          return;
        }
        setOpening(false);
        if (result.kind === "changed") {
          setFeedback({ tone: "warning", message: result.message });
          router.refresh();
          return;
        }
        setFeedback({ tone: "danger", message: result.message });
        if (result.refresh) router.refresh();
      });
    },
    [router],
  );

  const value = useMemo<PaySession>(
    () => ({ pending: opening || isPending, feedback, pay }),
    [opening, isPending, feedback, pay],
  );
  return <PaySessionContext.Provider value={value}>{children}</PaySessionContext.Provider>;
}

export function usePaySession(): PaySession {
  const session = useContext(PaySessionContext);
  if (!session) throw new Error("usePaySession must be used within PaySessionProvider");
  return session;
}
