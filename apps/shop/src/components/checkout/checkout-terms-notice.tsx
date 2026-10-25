import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import Link from "next/link";

/** Policy links open in a new tab so the shopper keeps what they have entered. */
function CheckoutPolicyLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      className="shop-checkout__terms-link shop-focus-ring"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

export function CheckoutTermsNotice() {
  return (
    <p className="shop-checkout__terms" data-testid="checkout-terms">
      By placing your order you agree to our{" "}
      <CheckoutPolicyLink href={SHOP_POLICY_PATHS.terms}>Terms of sale</CheckoutPolicyLink>. You can
      cancel within 14 days of receiving your order:{" "}
      <CheckoutPolicyLink href={SHOP_POLICY_PATHS.returns}>14-day cancellation</CheckoutPolicyLink>.
    </p>
  );
}
