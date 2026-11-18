import type { ExpressNotice } from "@/lib/checkout/express-checkout/express-checkout-state";
import type { ReactNode, Ref } from "react";

export type ExpressCheckoutPlacement = "basket" | "details";

const HEADING_ID = "express-checkout-heading";

/**
 * The wallet row's frame, shared by the placeholder and the loaded row so both take the same space
 * (no layout shift when Stripe.js arrives). Basket: "Or pay with" above the buttons, under
 * "Checkout". Details: "Express checkout" first, then "Or continue below" before the form.
 */
export function ExpressCheckoutShell({
  placement,
  buttons,
  buttonsRef,
  busy = false,
  notice = null,
  reserve = true,
  showButtons = true,
}: {
  placement: ExpressCheckoutPlacement;
  /** Stripe mounts its element here; empty while loading. */
  buttons?: ReactNode;
  buttonsRef?: Ref<HTMLFieldSetElement>;
  busy?: boolean;
  notice?: ExpressNotice | null;
  /** Keep the buttons' height while they load. */
  reserve?: boolean;
  showButtons?: boolean;
}) {
  const details = placement === "details";
  const body = (
    <>
      {details ? (
        <h2 id={HEADING_ID} className="shop-checkout__section-title">
          Express checkout
        </h2>
      ) : showButtons ? (
        <p className="shop-express__label" id={HEADING_ID}>
          Or pay with
        </p>
      ) : null}
      {showButtons ? (
        <fieldset
          ref={buttonsRef}
          aria-labelledby={HEADING_ID}
          aria-busy={busy || undefined}
          className={`shop-express__buttons${reserve ? " shop-express__buttons--reserved" : ""}`}
          data-testid="express-checkout-buttons"
        >
          {buttons}
        </fieldset>
      ) : null}
      {notice ? (
        <p
          className={`shop-express__notice shop-express__notice--${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}
      {details ? (
        <p className="shop-express__divider">
          <span>Or continue below</span>
        </p>
      ) : null}
    </>
  );
  return details ? (
    <section
      className="shop-checkout__section shop-express shop-express--details"
      aria-labelledby={HEADING_ID}
    >
      {body}
    </section>
  ) : (
    <div className="shop-express shop-express--basket">{body}</div>
  );
}
