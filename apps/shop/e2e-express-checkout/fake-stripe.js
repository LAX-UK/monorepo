/*
 * A stand-in for Stripe.js (https://js.stripe.com/basil/stripe.js) for the GAP-49 browser gate.
 * Served in place of the real script by Playwright, so no request reaches Stripe and no key is
 * needed. It implements only what the wallet row calls: initCheckout, the Express Checkout
 * Element's mount, events and destroy, confirm and runServerUpdate. Tests drive it through
 * window.__fakeStripe and choose its behaviour with window.__fakeStripeScenario.
 */
(() => {
  const scenario = () => window.__fakeStripeScenario || {};
  const state = { handlers: {}, confirms: [], mounted: false, failures: [] };
  window.__fakeStripe = state;

  function emit(name, event) {
    const handler = state.handlers[name];
    if (handler) handler(event);
  }

  // Wallet buttons drawn in the wallets' own colours, as the real element's frames would be.
  function drawButtons(target, available) {
    const row = document.createElement("div");
    row.setAttribute("data-fake-stripe", "express-checkout-element");
    row.style.cssText = "display:flex;gap:8px;width:100%";
    const theme = state.elementOptions?.buttonTheme || {};
    const colours = (name) => (theme[name] === "white" ? ["#fff", "#000"] : ["#000", "#fff"]);
    const buttons = [
      ["applePay", "Buy with Apple Pay", ...colours("applePay")],
      ["googlePay", "Buy with Google Pay", ...colours("googlePay")],
      ["link", "Pay with Link", "#00d66f", "#011e0f"],
    ];
    for (const [id, label, bg, fg] of buttons) {
      if (!available[id]) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-label", label);
      button.style.cssText = `flex:1;min-width:0;height:48px;border:0;border-radius:6px;background:${bg};color:${fg};font:600 15px system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
      row.appendChild(button);
    }
    target.appendChild(row);
  }

  window.Stripe = (publishableKey) => ({
    async initCheckout(options) {
      state.publishableKey = publishableKey;
      state.clientSecret = await options.fetchClientSecret();
      return {
        createExpressCheckoutElement(elementOptions) {
          state.elementOptions = elementOptions;
          return {
            on(name, handler) {
              state.handlers[name] = handler;
            },
            mount(target) {
              state.mounted = true;
              const s = scenario();
              if (s.hold) return;
              if (s.loadError) {
                setTimeout(() => emit("loaderror", { error: { message: "load failed" } }), 0);
                return;
              }
              const available = s.available ?? { applePay: true, googlePay: true, link: true };
              drawButtons(target, available);
              setTimeout(() => emit("ready", { availablePaymentMethods: available }), 0);
            },
            destroy() {
              state.mounted = false;
            },
          };
        },
        async runServerUpdate(update) {
          state.serverUpdates = (state.serverUpdates || 0) + 1;
          await update();
          return { type: "success" };
        },
        async confirm(options) {
          state.confirms.push(options.returnUrl);
          const s = scenario();
          return s.payment === "declined"
            ? { type: "error", error: { message: "Your card was declined." } }
            : { type: "success" };
        },
      };
    },
  });

  /** What a wallet sheet sends on confirm; tests may override any part. */
  state.confirm = (overrides = {}) => {
    const event = {
      billingDetails: { name: "Ada Lovelace", email: "ada@example.test", phone: "+447700900123" },
      shippingAddress: {
        name: "Ada Lovelace",
        address: {
          line1: "1 New Cavendish Street",
          city: "London",
          postal_code: "W1G 8UR",
          country: "GB",
        },
      },
      shippingRate: { id: "shr_fake_1", displayName: "Insured UK delivery", amount: 1500 },
      ...overrides,
      paymentFailed: (options) => state.failures.push(options || {}),
    };
    emit("confirm", event);
  };
  state.changeAddress = (address) =>
    new Promise((resolve) => {
      emit("shippingaddresschange", {
        address,
        resolve: () => resolve("resolved"),
        reject: () => resolve("rejected"),
      });
    });
  state.cancel = () => emit("cancel");
})();
