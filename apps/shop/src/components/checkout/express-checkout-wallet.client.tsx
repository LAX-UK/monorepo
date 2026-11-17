"use client";

import { cancelCheckoutOrder } from "@/app/actions/cancel-checkout.actions";
import {
  changeExpressShippingAddress,
  confirmExpressCheckout,
  startExpressCheckout,
} from "@/app/actions/express-checkout.actions";
import {
  EXPRESS_CANCELLED_MESSAGE,
  EXPRESS_UNAVAILABLE_MESSAGE,
  type ExpressCheckoutConfig,
} from "@/lib/checkout/express-checkout/express-checkout-api";
import {
  type ExpressFlowPorts,
  handleExpressAddressChange,
  handleExpressConfirm,
} from "@/lib/checkout/express-checkout/express-checkout-flow";
import {
  type ExpressRowState,
  INITIAL_EXPRESS_ROW_STATE,
  expressRowReducer,
  expressRowReservesSpace,
  expressRowShowsButtons,
} from "@/lib/checkout/express-checkout/express-checkout-state";
import {
  type ExpressCheckoutElement,
  loadStripeJs,
} from "@/lib/checkout/express-checkout/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import { type ExpressCheckoutPlacement, ExpressCheckoutShell } from "./express-checkout-shell";

/** Past this, a row still loading shows the one-line error rather than an empty space. */
const LOAD_TIMEOUT_MS = 12_000;

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** The buttons keep Stripe's and the wallets' own styles; only the size and theme are set. */
function elementOptions() {
  const dark = isDarkTheme();
  return {
    buttonHeight: 48,
    buttonTheme: { applePay: dark ? "white" : "black", googlePay: dark ? "white" : "black" },
    buttonType: { applePay: "buy", googlePay: "buy" },
    paymentMethods: { applePay: "auto", googlePay: "auto", link: "auto" },
    layout: { maxColumns: 3, maxRows: 1, overflow: "auto" },
  };
}

function statusLine(state: ExpressRowState) {
  switch (state.status) {
    case "ready":
      return state.notice;
    case "processing":
      return { tone: "info" as const, message: "Finishing your payment…" };
    case "paid":
      return { tone: "info" as const, message: "Payment received. Opening your order…" };
    case "error":
    case "sold_out":
      return { tone: "error" as const, message: state.message };
    default:
      return null;
  }
}

/**
 * The loaded wallet row: opens the basket's Checkout Session, mounts Stripe's Express Checkout
 * Element and answers its events. The order and its print hold are made only on confirm; Stripe
 * then takes the payment and the shopper lands on the existing order confirmation.
 */
export function ExpressCheckoutWallet({
  config,
  placement,
  marketingConsent,
}: {
  config: ExpressCheckoutConfig;
  placement: ExpressCheckoutPlacement;
  marketingConsent: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(expressRowReducer, INITIAL_EXPRESS_ROW_STATE);
  const buttonsRef = useRef<HTMLFieldSetElement>(null);
  const consentRef = useRef(marketingConsent);
  consentRef.current = marketingConsent;

  // biome-ignore lint/correctness/useExhaustiveDependencies: one session per mount and basket.
  useEffect(() => {
    let disposed = false;
    let element: ExpressCheckoutElement | null = null;
    const { audience, basketId, publishableKey } = config;
    const timeout = window.setTimeout(
      () => dispatch({ type: "load_failed", message: EXPRESS_UNAVAILABLE_MESSAGE }),
      LOAD_TIMEOUT_MS,
    );
    const fail = () => {
      if (!disposed) dispatch({ type: "load_failed", message: EXPRESS_UNAVAILABLE_MESSAGE });
    };

    (async () => {
      const [stripeFactory, start] = await Promise.all([
        loadStripeJs(),
        startExpressCheckout({ audience, basketId }),
      ]);
      if (disposed) return;
      if (start.kind === "unavailable") {
        dispatch({ type: "disabled" });
        return;
      }
      if (start.kind === "error") {
        dispatch({ type: "load_failed", message: start.message });
        return;
      }
      const { session } = start;
      const checkout = await stripeFactory(publishableKey).initCheckout({
        fetchClientSecret: async () => session.clientSecret,
        elementsOptions: { appearance: { theme: isDarkTheme() ? "night" : "stripe" } },
      });
      if (disposed || !buttonsRef.current) return;
      const mounted = checkout.createExpressCheckoutElement(elementOptions());
      element = mounted;

      mounted.on("ready", (event) => {
        const available = Object.values(event.availablePaymentMethods ?? {}).some(Boolean);
        dispatch({ type: "loaded", available });
      });
      mounted.on("loaderror", fail);
      mounted.on("click", (event) => {
        event.resolve({ emailRequired: audience === "guest", phoneNumberRequired: true });
      });
      const ports: ExpressFlowPorts = {
        audience,
        session,
        checkout,
        dispatch,
        changeAddress: (address) =>
          changeExpressShippingAddress({
            audience,
            basketId,
            sessionId: session.sessionId,
            address,
          }),
        confirmOrder: (payload) =>
          confirmExpressCheckout({
            audience,
            basketId,
            sessionId: session.sessionId,
            ...payload,
            ...(audience === "guest" ? { marketingConsent: consentRef.current } : {}),
          }),
        cancelOrder: cancelCheckoutOrder,
        refresh: () => router.refresh(),
        navigate: (href) => window.location.assign(href),
        origin: window.location.origin,
      };
      mounted.on("shippingaddresschange", (event) => {
        void handleExpressAddressChange(ports, event);
      });
      mounted.on("cancel", () => {
        dispatch({ type: "cancelled", message: EXPRESS_CANCELLED_MESSAGE });
      });
      mounted.on("confirm", (event) => {
        void handleExpressConfirm(ports, event);
      });

      mounted.mount(buttonsRef.current);
    })().catch(fail);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      element?.destroy();
    };
  }, [config.basketId]);

  if (state.status === "unavailable") return null;
  const showButtons = expressRowShowsButtons(state) || state.status === "loading";
  return (
    <ExpressCheckoutShell
      placement={placement}
      buttonsRef={buttonsRef}
      busy={state.status === "loading" || state.status === "processing"}
      reserve={expressRowReservesSpace(state)}
      showButtons={showButtons}
      notice={statusLine(state)}
    />
  );
}
