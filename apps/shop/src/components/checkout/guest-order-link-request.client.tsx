"use client";

import { requestGuestOrderLink } from "@/app/actions/guest-checkout.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { MarketingFormField } from "@auction/marketing-ui";
import { Input } from "@auction/ui";
import { useState, useTransition } from "react";

type Errors = { email?: string; reference?: string };

/**
 * Asks for a new link to a guest order. The answer is the same whether or not the email and
 * reference match, so the form cannot be used to find out who ordered what.
 */
export function GuestOrderLinkRequest() {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <ShopNotice tone="success" title="Check your email">
        If that email and order reference match an order, a new link is on its way. It works for 30
        days.
      </ShopNotice>
    );
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const next: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter the email address you used for the order";
    }
    if (reference.trim().length < 3) next.reference = "Enter the order reference, like LAX-S-10482";
    setErrors(next);
    setFailure(null);
    if (next.email || next.reference) return;
    startTransition(async () => {
      const result = await requestGuestOrderLink({ email, orderReference: reference });
      if (result.kind === "sent") setSent(true);
      else setFailure(result.message);
    });
  };

  return (
    <form className="shop-guest-email" noValidate onSubmit={onSubmit}>
      <div className="shop-checkout__field-grid">
        <MarketingFormField
          id="guest-link-email"
          label="Email address"
          error={errors.email ?? null}
          className="shop-checkout__field--full"
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              className="shop-field"
              disabled={pending}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </MarketingFormField>
        <MarketingFormField
          id="guest-link-reference"
          label="Order reference"
          hint="In your order confirmation email"
          error={errors.reference ?? null}
          className="shop-checkout__field--full"
        >
          {(control) => (
            <Input
              {...control}
              autoComplete="off"
              spellCheck={false}
              className="shop-field"
              disabled={pending}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          )}
        </MarketingFormField>
      </div>
      {failure ? (
        <ShopNotice tone="error" title="We could not send a link">
          {failure}
        </ShopNotice>
      ) : null}
      <div className="shop-guest-email__actions">
        <ShopCommerceButton
          type="submit"
          scale="standard"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Sending…" : "Email me a new link"}
        </ShopCommerceButton>
      </div>
    </form>
  );
}
