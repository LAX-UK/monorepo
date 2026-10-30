"use client";

import { checkGuestEmail } from "@/app/actions/guest-checkout.actions";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import {
  CheckoutOrderSummary,
  CheckoutSummaryDisclosure,
} from "@/components/checkout/checkout-order-summary";
import { ShopCommerceButton, shopButtonClassName } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import type { CheckoutDeliveryOptionVm } from "@/lib/checkout/checkout-delivery";
import { GUEST_EMAIL_MESSAGES, GUEST_SIGN_IN_RETURN_PATH } from "@/lib/checkout/guest-checkout";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { MarketingFormField } from "@auction/marketing-ui";
import type { BasketView } from "@auction/shop-contracts";
import { GUEST_MARKETING_CONSENT } from "@auction/shop-domain";
import { Checkbox, Input } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";

type Props = {
  basket: BasketView;
  deliveryOptions: readonly CheckoutDeliveryOptionVm[];
  showTermsNotice: boolean;
};

type Step =
  | { kind: "email" }
  | { kind: "known"; email: string }
  | { kind: "details"; email: string; marketingConsent: boolean };

const EMAIL_FIELD_ID = "guest-checkout-email";

/** Sign-in returns to checkout, where the basket is merged; the known email arrives prefilled. */
function signInHref(email?: string): string {
  return shopStorefrontLoginHref(GUEST_SIGN_IN_RETURN_PATH, { loginHint: email ?? null });
}

/**
 * Checkout without an account: the email comes first. A new email goes on to delivery and
 * payment as a guest; an email that already has a LAX account signs in instead, keeping the
 * basket. Nothing here asks for a password.
 */
export function GuestCheckout({ basket, deliveryOptions, showTermsNotice }: Props) {
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  // Coming back from "Use a different email" focuses the email with its text selected.
  const [selectEmailOnShow, setSelectEmailOnShow] = useState(false);

  if (step.kind === "details") {
    return (
      <CheckoutForm
        basket={basket}
        deliveryOptions={deliveryOptions}
        savedAddresses={[]}
        manageAddressesHref={null}
        showTermsNotice={showTermsNotice}
        guest={{
          email: step.email,
          marketingConsent: step.marketingConsent,
          onChangeEmail: () => setStep({ kind: "email" }),
          onSignInRequired: () => setStep({ kind: "known", email: step.email }),
        }}
      />
    );
  }

  return (
    <div className="shop-checkout__layout">
      <CheckoutSummaryDisclosure basket={basket} fulfilment="uk_insured_delivery" />
      <div className="shop-checkout__form">
        {step.kind === "known" ? (
          <KnownAccount
            email={step.email}
            onUseAnother={() => {
              setSelectEmailOnShow(true);
              setStep({ kind: "email" });
            }}
          />
        ) : (
          <GuestEmailStep
            email={email}
            selectOnShow={selectEmailOnShow}
            marketingConsent={marketingConsent}
            onEmailChange={setEmail}
            onConsentChange={setMarketingConsent}
            onKnownAccount={(checked) => setStep({ kind: "known", email: checked })}
            onContinue={(checked) => setStep({ kind: "details", email: checked, marketingConsent })}
          />
        )}
      </div>
      <CheckoutOrderSummary
        basket={basket}
        fulfilment="uk_insured_delivery"
        showTermsNotice={false}
        action={null}
      />
    </div>
  );
}

function emailProblem(value: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? null
    : GUEST_EMAIL_MESSAGES.invalid_email;
}

function GuestEmailStep({
  email,
  selectOnShow,
  marketingConsent,
  onEmailChange,
  onConsentChange,
  onKnownAccount,
  onContinue,
}: {
  email: string;
  selectOnShow: boolean;
  marketingConsent: boolean;
  onEmailChange: (email: string) => void;
  onConsentChange: (consent: boolean) => void;
  onKnownAccount: (email: string) => void;
  onContinue: (email: string) => void;
}) {
  const [website, setWebsite] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const privacyId = useId();
  const consentId = useId();

  useEffect(() => {
    if (!selectOnShow) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [selectOnShow]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setFailure(null);
    const value = email.trim();
    const problem = emailProblem(value);
    if (problem) {
      setFieldError(problem);
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    startTransition(async () => {
      const result = await checkGuestEmail({
        email: value,
        marketingConsent,
        ...(website ? { website } : {}),
      });
      if (result.kind === "continue_as_guest") onContinue(value);
      else if (result.kind === "sign_in_required") onKnownAccount(value);
      else if (result.problem === "invalid_email") {
        setFieldError(result.message);
        inputRef.current?.focus();
      } else setFailure(result.message);
    });
  };

  return (
    <section className="shop-checkout__section" aria-labelledby="guest-email-heading">
      <h2 id="guest-email-heading" className="shop-checkout__section-title">
        Your email
      </h2>
      <p className="shop-checkout__paying-as">
        Check out without an account, or sign in if you have one. We send your receipt and order
        updates to this email.
      </p>
      <form className="shop-guest-email" noValidate onSubmit={onSubmit}>
        <MarketingFormField
          id={EMAIL_FIELD_ID}
          label="Email address"
          error={fieldError}
          className="shop-guest-email__field"
        >
          {(control) => (
            <Input
              {...control}
              ref={inputRef}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              className="shop-field"
              disabled={pending}
              value={email}
              onChange={(event) => {
                // Checked when the field is left or the form sent, not on every keystroke.
                setFieldError(null);
                setFailure(null);
                onEmailChange(event.target.value);
              }}
              onBlur={() => {
                if (email.trim()) setFieldError(emailProblem(email));
              }}
              aria-describedby={[control["aria-describedby"], privacyId].filter(Boolean).join(" ")}
            />
          )}
        </MarketingFormField>

        <label htmlFor={consentId} className="shop-checkout__save">
          <Checkbox
            id={consentId}
            className="shop-checkbox"
            checked={marketingConsent}
            disabled={pending}
            onCheckedChange={(checked) => onConsentChange(checked === true)}
          />
          <span>
            {GUEST_MARKETING_CONSENT.label}
            <span className="shop-checkout__save-hint">{GUEST_MARKETING_CONSENT.hint}</span>
          </span>
        </label>

        {/* Left empty by people; a bot that fills every field is dropped by the API. */}
        <div className="shop-alert__trap" aria-hidden="true">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
        </div>

        {failure ? (
          <ShopNotice tone="error" title="We could not continue">
            {failure}
          </ShopNotice>
        ) : null}

        <div className="shop-guest-email__actions">
          <ShopCommerceButton
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className="shop-guest-email__continue"
          >
            {pending ? "Checking…" : "Continue as guest"}
          </ShopCommerceButton>
          <SignInButton variant="outline" href={signInHref()} />
        </div>

        <p id={privacyId} className="shop-guest-email__privacy">
          We use your email for this order and, if you ask, for news from LAX Shop. Read our{" "}
          <Link href={SHOP_POLICY_PATHS.privacy} className="shop-inline-link shop-focus-ring">
            privacy notice
          </Link>
          .
        </p>
      </form>
    </section>
  );
}

/** Sign-in starts on Shop Identity, so it is a plain link: never prefetched. */
function SignInButton({ variant, href }: { variant: "cta" | "outline"; href: string }) {
  return (
    <Button
      asChild
      variant={variant}
      size="lg"
      className={shopButtonClassName(variant, "commerce")}
    >
      <a href={href}>Sign in</a>
    </Button>
  );
}

/** Focus moves to the heading when this replaces the email form, so it is read straight away. */
function KnownAccount({ email, onUseAnother }: { email: string; onUseAnother: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section
      className="shop-checkout__section shop-guest-known"
      aria-labelledby="guest-known-heading"
    >
      <h2
        id="guest-known-heading"
        ref={headingRef}
        tabIndex={-1}
        className="shop-checkout__section-title shop-guest-known__heading"
      >
        Sign in to continue
      </h2>
      <p className="shop-guest-known__text">
        You already have a LAX account with <strong>{email}</strong>. Sign in to continue; your
        basket is saved.
      </p>
      <div className="shop-guest-email__actions">
        <SignInButton variant="cta" href={signInHref(email)} />
        <ShopCommerceButton type="button" variant="outline" scale="commerce" onClick={onUseAnother}>
          Use a different email
        </ShopCommerceButton>
      </div>
    </section>
  );
}
