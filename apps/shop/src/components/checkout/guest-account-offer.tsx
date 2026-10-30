import { shopButtonClassName } from "@/components/shop-commerce-button";
import { GUEST_CREATE_ACCOUNT_HREF } from "@/lib/checkout/guest-order.vm";
import { Button } from "@auction/ui/components/button";

/**
 * After a guest order: a LAX account with the same email keeps every order in one place. The
 * order moves into the account once the email is confirmed there.
 */
export function GuestAccountOffer({ email, headingId }: { email: string; headingId: string }) {
  return (
    <section className="shop-order-panel shop-guest-offer" aria-labelledby={headingId}>
      <h2 id={headingId} className="shop-order-panel__title">
        Keep your orders in one place
      </h2>
      <p className="shop-order-panel__text">
        Create a LAX account with <strong className="shop-guest-offer__email">{email}</strong>. Once
        you confirm the email, this order moves into your account with its progress and invoice.
      </p>
      <Button
        asChild
        variant="outline"
        size="lg"
        className={shopButtonClassName("outline", "standard", "shop-guest-offer__action")}
      >
        <a href={GUEST_CREATE_ACCOUNT_HREF}>Create your LAX account</a>
      </Button>
    </section>
  );
}
