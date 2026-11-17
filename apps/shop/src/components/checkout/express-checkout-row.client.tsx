"use client";

import type { ExpressCheckoutConfig } from "@/lib/checkout/express-checkout/express-checkout-api";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { type ExpressCheckoutPlacement, ExpressCheckoutShell } from "./express-checkout-shell";

export type { ExpressCheckoutConfig };

// The wallet and Stripe.js load only once the row is on screen, never with the page.
const ExpressCheckoutWallet = lazy(() =>
  import("./express-checkout-wallet.client").then((module) => ({
    default: module.ExpressCheckoutWallet,
  })),
);

/**
 * GAP-49 wallet row (Apple Pay, Google Pay, Link). Reserves the buttons' height straight away,
 * and loads the wallet code and Stripe.js when the row nears the viewport. Renders nothing when
 * there is no config, so with the flag off the pages are exactly as before.
 */
export function ExpressCheckoutRow({
  config,
  placement,
  marketingConsent = false,
  hidden = false,
}: {
  config: ExpressCheckoutConfig | null;
  placement: ExpressCheckoutPlacement;
  marketingConsent?: boolean;
  /** Hides the row but keeps the wallet mounted (Details on a quote path). */
  hidden?: boolean;
}) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!config || visible) return;
    const target = placeholderRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [config, visible]);

  if (!config) return null;
  const placeholder = <ExpressCheckoutShell placement={placement} busy />;
  return (
    <div ref={placeholderRef} className="shop-express__slot" hidden={hidden}>
      {visible ? (
        <Suspense fallback={placeholder}>
          <ExpressCheckoutWallet
            config={config}
            placement={placement}
            marketingConsent={marketingConsent}
          />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
