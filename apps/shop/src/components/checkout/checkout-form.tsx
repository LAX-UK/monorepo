"use client";

import { startCheckout } from "@/app/actions/checkout.actions";
import {
  requestDeliveryQuote,
  requestGuestDeliveryQuote,
} from "@/app/actions/delivery-quote.actions";
import { startGuestCheckout } from "@/app/actions/guest-checkout.actions";
import {
  CheckoutOrderSummary,
  CheckoutSummaryDisclosure,
} from "@/components/checkout/checkout-order-summary";
import { DeliveryQuoteSent } from "@/components/checkout/delivery-quote-sent";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import {
  type CheckoutDeliveryChoice,
  type CheckoutDeliveryOptionVm,
  isCheckoutDeliveryChoice,
  isPayableDeliveryChoice,
  isQuoteDeliveryChoice,
} from "@/lib/checkout/checkout-delivery";
import {
  CHECKOUT_FIELD_IDS,
  type CheckoutDetails,
  type CheckoutField,
  type CheckoutFieldErrors,
  checkoutDeliveryPayload,
  initialCheckoutAddress,
  isDeliverableSavedAddress,
  orderedCheckoutErrors,
  outsideUkDeliveryPayload,
  validateCheckoutDetails,
} from "@/lib/checkout/checkout-details";
import type { DeliveryQuoteStartResult } from "@/lib/checkout/delivery-quote-request";
import { countryName, outsideUkCountryOptions } from "@/lib/checkout/outside-uk";
import { MarketingFormErrorSummary, MarketingFormField } from "@auction/marketing-ui";
import type { BasketView, SavedDeliveryAddress } from "@auction/shop-contracts";
import { Checkbox, Input, RadioCardGroup } from "@auction/ui";
import { NativeSelect } from "@auction/ui/lax";
import { type ReactNode, useMemo, useState, useTransition } from "react";

type Props = {
  basket: BasketView;
  deliveryOptions: readonly CheckoutDeliveryOptionVm[];
  savedAddresses: readonly SavedDeliveryAddress[];
  customerEmail?: string;
  /** The verified phone on the LAX Account, used when a saved address has none. */
  defaultDeliveryPhone?: string;
  /** False on production while the terms or returns page is still a draft, so nothing links to a 404. */
  showTermsNotice: boolean;
  /** LAX Account's address book, for "Manage addresses"; null when it cannot be linked. */
  manageAddressesHref: string | null;
  /** Checkout without an account, after the email step. */
  guest?: GuestCheckoutBuyer;
};

/** The guest the email step let through, and the ways back to that step. */
export type GuestCheckoutBuyer = {
  email: string;
  marketingConsent: boolean;
  onChangeEmail: () => void;
  /** The server found a LAX account for the email after all. */
  onSignInRequired: () => void;
};

const FORM_ID = "checkout-form";

/** Who it is for and where, as one line under the address's name in LAX Account. */
function addressLines(address: SavedDeliveryAddress): string {
  return [address.recipientName, address.line1, address.line2, address.city, address.postcode]
    .filter(Boolean)
    .join(", ");
}

/** The radio cards for the address book, then "Use a new address". */
function savedAddressOptions(saved: readonly SavedDeliveryAddress[], disabled: boolean) {
  return [
    ...saved.map((address, index) => {
      const deliverable = isDeliverableSavedAddress(address);
      return {
        value: address.id,
        // The first card carries the field id, so the error summary can move focus to the group.
        ...(index === 0 ? { id: CHECKOUT_FIELD_IDS.savedAddress } : {}),
        label: address.label,
        ...(address.isDefaultShipping ? { meta: "Default" } : {}),
        description: deliverable
          ? addressLines(address)
          : `${addressLines(address)}. Not a UK address, so UK delivery cannot use it.`,
        disabled: disabled || !deliverable,
      };
    }),
    {
      value: "new",
      ...(saved.length === 0 ? { id: CHECKOUT_FIELD_IDS.savedAddress } : {}),
      label: "Use a new address",
      disabled,
    },
  ];
}

export function CheckoutForm({
  basket,
  deliveryOptions,
  savedAddresses,
  customerEmail,
  defaultDeliveryPhone,
  showTermsNotice,
  manageAddressesHref,
  guest,
}: Props) {
  const initialAddress = initialCheckoutAddress(savedAddresses);
  const initialPhone =
    savedAddresses.find((address) => address.id === initialAddress)?.phone ??
    defaultDeliveryPhone ??
    "";
  const [details, setDetails] = useState<CheckoutDetails>({
    choice: "uk_insured_delivery",
    contactName: "",
    address: initialAddress,
    recipientName: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
    country: "",
    phone: initialPhone,
    saveAddress: true,
  });
  const [phoneEdited, setPhoneEdited] = useState(false);
  // A guest's name fills the recipient until they type a different one.
  const [recipientEdited, setRecipientEdited] = useState(false);
  const validationOptions = { requireContactName: Boolean(guest) };
  const [showLine2, setShowLine2] = useState(false);
  // Errors appear on submit; after that each field is checked again as it changes.
  const [submitCount, setSubmitCount] = useState(0);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  // Problems the shop API named after a delivery quote request, shown against each field.
  const [serverFieldErrors, setServerFieldErrors] = useState<CheckoutFieldErrors>({});
  // How a delivery quote request ended, when it did not go to payment.
  const [quoteOutcome, setQuoteOutcome] = useState<Extract<
    DeliveryQuoteStartResult,
    { kind: "quote_requested" | "not_delivered" }
  > | null>(null);
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const busy = pending || redirecting;

  const errors: CheckoutFieldErrors = {
    ...(submitCount > 0 ? validateCheckoutDetails(details, savedAddresses, validationOptions) : {}),
    ...serverFieldErrors,
  };
  const summaryErrors = orderedCheckoutErrors(errors);
  const payable = isPayableDeliveryChoice(details.choice);
  const quoting = isQuoteDeliveryChoice(details.choice);
  const countryOptions = useMemo(() => outsideUkCountryOptions(), []);

  const update = (patch: Partial<CheckoutDetails>) => {
    setServerError(null);
    setServerFieldErrors({});
    setQuoteOutcome((current) => (current?.kind === "not_delivered" ? null : current));
    setDetails((current) => ({ ...current, ...patch }));
  };

  const chooseAddress = (address: string) => {
    const phone = savedAddresses.find((saved) => saved.id === address)?.phone;
    update({ address, ...(phone && !phoneEdited ? { phone } : {}) });
  };

  const field = (
    name: Exclude<CheckoutField, "savedAddress">,
    label: string,
    input: { autoComplete: string; type?: string; inputMode?: "tel" },
    extra: { hint?: ReactNode; optional?: boolean; className?: string } = {},
  ) => (
    <MarketingFormField
      id={CHECKOUT_FIELD_IDS[name]}
      label={label}
      error={errors[name] ?? null}
      {...extra}
    >
      {(control) => (
        <Input
          {...control}
          name={name}
          className="shop-field"
          type={input.type ?? "text"}
          autoComplete={input.autoComplete}
          {...(input.inputMode ? { inputMode: input.inputMode } : {})}
          disabled={busy}
          value={details[name]}
          onChange={(event) => {
            const value = event.target.value;
            if (name === "phone") setPhoneEdited(true);
            if (name === "recipientName") setRecipientEdited(true);
            update({
              [name]: value,
              ...(name === "contactName" && !recipientEdited ? { recipientName: value } : {}),
            });
          }}
        />
      )}
    </MarketingFormField>
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !(payable || quoting)) return;
    setSubmitCount((count) => count + 1);
    setServerError(null);
    const found = validateCheckoutDetails(details, savedAddresses, validationOptions);
    if (Object.keys(found).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    if (quoting) {
      const quote = outsideUkDeliveryPayload(details);
      startTransition(async () => {
        const result = guest
          ? await requestGuestDeliveryQuote({
              basketId: basket.basketId,
              email: guest.email,
              name: details.contactName,
              marketingConsent: guest.marketingConsent,
              ...quote,
            })
          : await requestDeliveryQuote({ basketId: basket.basketId, ...quote });
        if (result.kind === "sign_in_required") {
          guest?.onSignInRequired();
          return;
        }
        if (result.kind === "error") {
          setServerError(result.message);
          return;
        }
        if (result.kind === "fields") {
          setServerFieldErrors(result.errors);
          setFailedSubmits((count) => count + 1);
          return;
        }
        if (result.kind === "pay") {
          setRedirecting(true);
          window.location.href = result.checkoutUrl;
          return;
        }
        setQuoteOutcome(result);
      });
      return;
    }
    const delivery = checkoutDeliveryPayload(details, savedAddresses);
    startTransition(async () => {
      const deliveryFields = delivery
        ? { deliveryAddress: delivery.deliveryAddress, deliveryPhone: delivery.deliveryPhone }
        : {};
      const result = guest
        ? await startGuestCheckout({
            basketId: basket.basketId,
            email: guest.email,
            name: details.contactName,
            marketingConsent: guest.marketingConsent,
            fulfilment: details.choice,
            ...deliveryFields,
          })
        : await startCheckout({
            basketId: basket.basketId,
            fulfilment: details.choice,
            ...(delivery ? { ...deliveryFields, saveAddress: delivery.saveAddress } : {}),
          });
      if (result.kind === "sign_in_required") {
        guest?.onSignInRequired();
        return;
      }
      if (result.kind === "error") {
        // Everything entered stays as it is; only the message is added.
        setServerError(result.message);
        return;
      }
      setRedirecting(true);
      window.location.href = result.checkoutUrl;
    });
  };

  const submitLabel = redirecting
    ? "Opening secure payment…"
    : pending
      ? "Starting payment…"
      : "Continue to secure payment";

  if (quoteOutcome?.kind === "quote_requested") {
    return (
      <DeliveryQuoteSent
        orderReference={quoteOutcome.orderReference}
        country={quoteOutcome.country}
        holdUntil={quoteOutcome.holdUntil}
      />
    );
  }

  return (
    <div className="shop-checkout__layout">
      <CheckoutSummaryDisclosure basket={basket} fulfilment={details.choice} />
      <form id={FORM_ID} className="shop-checkout__form" noValidate onSubmit={onSubmit}>
        <MarketingFormErrorSummary errors={summaryErrors} focusKey={failedSubmits} />
        {guest ? (
          <section className="shop-checkout__section" aria-labelledby="checkout-you-heading">
            <div className="shop-checkout__section-head">
              <h2 id="checkout-you-heading" className="shop-checkout__section-title">
                Your details
              </h2>
              <button
                type="button"
                className="shop-inline-link shop-focus-ring"
                disabled={busy}
                onClick={guest.onChangeEmail}
              >
                Change email
              </button>
            </div>
            <p className="shop-checkout__paying-as">
              Checking out as <strong>{guest.email}</strong>. We send the receipt and updates here.
            </p>
            <div className="shop-checkout__field-grid">
              {field(
                "contactName",
                "Full name",
                { autoComplete: "name" },
                {
                  hint: "As it should appear on your invoice",
                  className: "shop-checkout__field--full",
                },
              )}
            </div>
          </section>
        ) : customerEmail ? (
          <p className="shop-checkout__paying-as">
            Paying as <strong>{customerEmail}</strong>. We send the receipt and updates here.
          </p>
        ) : null}

        <section className="shop-checkout__section" aria-labelledby="checkout-delivery-heading">
          <h2 id="checkout-delivery-heading" className="shop-checkout__section-title">
            Delivery
          </h2>
          <RadioCardGroup
            legend="How would you like to receive your order?"
            hideLegend
            value={details.choice}
            onValueChange={(value) => {
              if (isCheckoutDeliveryChoice(value))
                update({ choice: value as CheckoutDeliveryChoice });
            }}
            options={deliveryOptions.map((option) => ({
              value: option.value,
              label: option.label,
              ...(option.price ? { meta: option.price } : {}),
              description: (
                <>
                  <span className="shop-delivery-option__description">{option.description}</span>
                  {option.timing ? (
                    <span className="shop-delivery-option__timing">{option.timing}</span>
                  ) : null}
                </>
              ),
              disabled: busy,
            }))}
            optionClassName="shop-radio-card"
          />
        </section>

        {details.choice === "uk_insured_delivery" ? (
          <section className="shop-checkout__section" aria-labelledby="checkout-address-heading">
            <div className="shop-checkout__section-head">
              <h2 id="checkout-address-heading" className="shop-checkout__section-title">
                Delivery address
              </h2>
              {savedAddresses.length > 0 && manageAddressesHref ? (
                <a
                  href={manageAddressesHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shop-inline-link shop-focus-ring"
                >
                  Manage addresses
                  <span className="sr-only"> in LAX Account (opens in a new tab)</span>
                </a>
              ) : null}
            </div>
            {savedAddresses.length > 0 ? (
              <div
                className={
                  errors.savedAddress ? "marketing-form-field marketing-form-field--error" : ""
                }
              >
                {errors.savedAddress ? (
                  <p
                    className="marketing-form-field__error"
                    id={`${CHECKOUT_FIELD_IDS.savedAddress}-error`}
                  >
                    <span className="sr-only">Error: </span>
                    {errors.savedAddress}
                  </p>
                ) : null}
                <RadioCardGroup
                  legend="Saved addresses from your LAX Account"
                  value={details.address}
                  onValueChange={chooseAddress}
                  options={savedAddressOptions(savedAddresses, busy)}
                  optionClassName="shop-radio-card"
                  className="shop-checkout__saved"
                />
              </div>
            ) : null}

            {details.address === "new" ? (
              <div className="shop-checkout__field-grid">
                {field(
                  "recipientName",
                  "Full name",
                  { autoComplete: "shipping name" },
                  {
                    hint: "The person receiving the delivery",
                    className: "shop-checkout__field--full",
                  },
                )}
                {field(
                  "line1",
                  "Address line 1",
                  { autoComplete: "shipping address-line1" },
                  { className: "shop-checkout__field--full" },
                )}
                {showLine2 || details.line2 ? (
                  field(
                    "line2",
                    "Address line 2",
                    { autoComplete: "shipping address-line2" },
                    { optional: true, className: "shop-checkout__field--full" },
                  )
                ) : (
                  <button
                    type="button"
                    className="shop-checkout__add-line shop-focus-ring"
                    disabled={busy}
                    onClick={() => {
                      setShowLine2(true);
                      requestAnimationFrame(() =>
                        document.getElementById(CHECKOUT_FIELD_IDS.line2)?.focus(),
                      );
                    }}
                  >
                    Add another address line
                  </button>
                )}
                {field("city", "Town or city", { autoComplete: "shipping address-level2" })}
                {field(
                  "postcode",
                  "Postcode",
                  { autoComplete: "shipping postal-code" },
                  { className: "shop-checkout__field--postcode" },
                )}
                <div className="shop-checkout__field--full shop-checkout__country">
                  <p className="shop-checkout__country-label">Country</p>
                  <p className="shop-checkout__country-value">United Kingdom</p>
                </div>
                {customerEmail ? (
                  <label
                    htmlFor="checkout-save-address"
                    className="shop-checkout__save shop-checkout__field--full"
                  >
                    <Checkbox
                      id="checkout-save-address"
                      className="shop-checkbox"
                      checked={details.saveAddress}
                      disabled={busy}
                      onCheckedChange={(checked) => update({ saveAddress: checked === true })}
                    />
                    <span>
                      Save this address to your LAX Account
                      <span className="shop-checkout__save-hint">
                        Choose it next time instead of typing it again.
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="shop-checkout__field-grid">
              {field(
                "phone",
                "Phone number",
                { autoComplete: "shipping tel", type: "tel", inputMode: "tel" },
                {
                  hint: "Our courier uses this only to arrange delivery.",
                  className: "shop-checkout__field--full",
                },
              )}
            </div>
          </section>
        ) : null}

        {details.choice === "collect_new_cavendish" ? (
          <p className="shop-checkout__note">
            Bring photo ID when you collect. Someone else can collect for you with your written
            authority.
          </p>
        ) : null}

        {quoting ? (
          <section
            className="shop-checkout__section"
            aria-labelledby="checkout-international-heading"
          >
            <h2 id="checkout-international-heading" className="shop-checkout__section-title">
              Delivery address outside the UK
            </h2>
            <p className="shop-checkout__note">
              We quote delivery for each order and email you the price within one working day. Your
              print is held for you for 3 working days. You pay for the print and delivery together,
              and you pay any import duties and taxes where you live. Insurance is in the quote.
            </p>
            <div className="shop-checkout__field-grid">
              {field(
                "recipientName",
                "Full name",
                { autoComplete: "shipping name" },
                {
                  hint: "The person receiving the delivery",
                  className: "shop-checkout__field--full",
                },
              )}
              {field(
                "line1",
                "Address line 1",
                { autoComplete: "shipping address-line1" },
                { className: "shop-checkout__field--full" },
              )}
              {showLine2 || details.line2 ? (
                field(
                  "line2",
                  "Address line 2",
                  { autoComplete: "shipping address-line2" },
                  { optional: true, className: "shop-checkout__field--full" },
                )
              ) : (
                <button
                  type="button"
                  className="shop-checkout__add-line shop-focus-ring"
                  disabled={busy}
                  onClick={() => {
                    setShowLine2(true);
                    requestAnimationFrame(() =>
                      document.getElementById(CHECKOUT_FIELD_IDS.line2)?.focus(),
                    );
                  }}
                >
                  Add another address line
                </button>
              )}
              {field("city", "Town or city", { autoComplete: "shipping address-level2" })}
              {field(
                "postcode",
                "Postal code",
                { autoComplete: "shipping postal-code" },
                { className: "shop-checkout__field--postcode" },
              )}
              <MarketingFormField
                id={CHECKOUT_FIELD_IDS.country}
                label="Country"
                error={errors.country ?? null}
                className="shop-checkout__field--full"
              >
                {(control) => (
                  <NativeSelect
                    {...control}
                    name="country"
                    autoComplete="shipping country"
                    disabled={busy}
                    value={details.country}
                    onValueChange={(country) => update({ country })}
                    options={countryOptions}
                  />
                )}
              </MarketingFormField>
              {field(
                "phone",
                "Phone number",
                { autoComplete: "shipping tel", type: "tel", inputMode: "tel" },
                {
                  hint: "With the country code. Our courier uses it only to arrange delivery.",
                  className: "shop-checkout__field--full",
                },
              )}
            </div>
            {quoteOutcome?.kind === "not_delivered" ? (
              <div className="shop-checkout__refusal" role="alert">
                <h3 className="shop-checkout__refusal-title">
                  We cannot deliver to {countryName(quoteOutcome.country)}
                </h3>
                <p>
                  Export rules mean we do not ship there. You can still collect your print from our
                  London gallery, or someone you trust can collect it for you.
                </p>
                <ShopCommerceButton
                  type="button"
                  variant="outline"
                  onClick={() => update({ choice: "collect_new_cavendish" })}
                >
                  Collect from our London gallery instead
                </ShopCommerceButton>
              </div>
            ) : null}
          </section>
        ) : null}
      </form>

      <CheckoutOrderSummary
        basket={basket}
        fulfilment={details.choice}
        showTermsNotice={showTermsNotice && payable}
        action={
          payable ? (
            <>
              {serverError ? (
                <div className="shop-checkout__server-error" role="alert">
                  <p className="shop-checkout__server-error-title">Payment could not start</p>
                  <p>{serverError}</p>
                </div>
              ) : null}
              <ShopCommerceButton
                type="submit"
                form={FORM_ID}
                disabled={busy}
                className="shop-checkout__submit"
              >
                {submitLabel}
              </ShopCommerceButton>
              <p className="shop-checkout__submit-note">
                You pay on our secure payment page, then come back here.
              </p>
            </>
          ) : quoting ? (
            <>
              {serverError ? (
                <div className="shop-checkout__server-error" role="alert">
                  <p className="shop-checkout__server-error-title">Your request was not sent</p>
                  <p>{serverError}</p>
                </div>
              ) : null}
              <ShopCommerceButton
                type="submit"
                form={FORM_ID}
                disabled={busy}
                className="shop-checkout__submit"
              >
                {redirecting
                  ? "Opening secure payment…"
                  : pending
                    ? "Sending your request…"
                    : "Ask for a delivery quote"}
              </ShopCommerceButton>
              <p className="shop-checkout__submit-note">
                Nothing is charged now. We email you the delivery price, and you decide then.
              </p>
            </>
          ) : null
        }
      />
    </div>
  );
}
