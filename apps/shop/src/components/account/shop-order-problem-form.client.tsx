"use client";

import { reportOrderProblem } from "@/app/actions/order-problem.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import {
  ORDER_PROBLEM_DETAILS_MAX_LENGTH,
  ORDER_PROBLEM_FIELD_IDS,
  ORDER_PROBLEM_REASON_OPTIONS,
  type OrderProblemDetails,
  isOrderProblemReason,
  orderedOrderProblemErrors,
  validateOrderProblem,
} from "@/lib/account/order-problem";
import {
  MarketingCheckIcon,
  MarketingFormErrorSummary,
  MarketingFormField,
} from "@auction/marketing-ui";
import { RadioCardGroup, Textarea } from "@auction/ui";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  orderId: string;
  orderName: string;
  orderHref: string;
  /** "until 18 Nov 2026", or null before delivery. */
  until: string | null;
  /** The returns and cancellations page, when it is published. */
  returnsHref: string | null;
};

/**
 * "Report a problem": a reason and what happened, sent to our team. On success the form gives way
 * to a confirmation that takes focus, so the outcome is announced.
 */
export function ShopOrderProblemForm({ orderId, orderName, orderHref, until, returnsHref }: Props) {
  const [details, setDetails] = useState<OrderProblemDetails>({ reason: "", details: "" });
  const [submitCount, setSubmitCount] = useState(0);
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "closed" | null>(null);
  const [pending, startTransition] = useTransition();
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outcome) doneRef.current?.focus();
  }, [outcome]);

  const errors = submitCount > 0 ? validateOrderProblem(details) : {};

  if (outcome === "sent") {
    return (
      <div ref={doneRef} tabIndex={-1} className="shop-problem-done">
        <MarketingCheckIcon className="shop-problem-done__icon" aria-hidden />
        <div className="shop-problem-done__copy">
          <h2 className="shop-problem-done__title">Report sent</h2>
          <p className="shop-problem-done__text">
            We have your report about {orderName}. Our team will reply by email.
          </p>
          <Link href={orderHref} className="shop-inline-link shop-focus-ring">
            Back to {orderName}
          </Link>
        </div>
      </div>
    );
  }

  if (outcome === "closed") {
    return (
      <div ref={doneRef} tabIndex={-1} className="shop-problem-done is-closed">
        <div className="shop-problem-done__copy">
          <h2 className="shop-problem-done__title">This order can no longer be reported here</h2>
          <p className="shop-problem-done__text">
            The 14 days to cancel or report a problem have ended.{" "}
            <Link href="/help" className="shop-inline-link shop-focus-ring">
              Contact us
            </Link>{" "}
            if something is wrong.
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setSubmitCount((count) => count + 1);
    setServerError(null);
    const found = validateOrderProblem(details);
    if (Object.keys(found).length > 0 || !isOrderProblemReason(details.reason)) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    const reason = details.reason;
    startTransition(async () => {
      const result = await reportOrderProblem(orderId, { reason, details: details.details });
      if (result.kind === "error") {
        setServerError(result.message);
        return;
      }
      setOutcome(result.kind);
    });
  };

  return (
    <form className="shop-problem-form" noValidate onSubmit={onSubmit}>
      <MarketingFormErrorSummary
        errors={orderedOrderProblemErrors(errors)}
        focusKey={failedSubmits}
      />
      <p className="shop-problem-form__intro">
        Tell us what went wrong with {orderName}. Your report goes to our team, who will reply by
        email.{" "}
        {until
          ? `You can cancel or report a problem until ${until}.`
          : "You can cancel or report a problem until 14 days after delivery."}
        {returnsHref ? (
          <>
            {" "}
            <Link href={returnsHref} className="shop-inline-link shop-focus-ring">
              Returns and cancellations
            </Link>
          </>
        ) : null}
      </p>

      <RadioCardGroup
        legend="What went wrong?"
        value={details.reason}
        onValueChange={(value) => {
          if (!isOrderProblemReason(value)) return;
          setServerError(null);
          setDetails((current) => ({ ...current, reason: value }));
        }}
        options={ORDER_PROBLEM_REASON_OPTIONS.map((option, index) => ({
          value: option.value,
          label: option.label,
          ...(option.description ? { description: option.description } : {}),
          ...(index === 0 ? { id: ORDER_PROBLEM_FIELD_IDS.reason } : {}),
          disabled: pending,
        }))}
        {...(errors.reason ? { error: errors.reason } : {})}
        className="shop-problem-form__reasons"
        optionClassName="shop-radio-card"
      />

      <MarketingFormField
        id={ORDER_PROBLEM_FIELD_IDS.details}
        label="What happened?"
        hint="Include anything that helps us put it right, such as what is damaged."
        error={errors.details ?? null}
      >
        {(control) => (
          <Textarea
            {...control}
            name="details"
            rows={6}
            maxLength={ORDER_PROBLEM_DETAILS_MAX_LENGTH}
            className="shop-field shop-problem-form__details"
            disabled={pending}
            value={details.details}
            onChange={(event) => {
              setServerError(null);
              setDetails((current) => ({ ...current, details: event.target.value }));
            }}
          />
        )}
      </MarketingFormField>

      {serverError ? (
        <p className="shop-problem-form__error" role="alert">
          {serverError}
        </p>
      ) : null}

      <div className="shop-problem-form__actions">
        <ShopCommerceButton
          type="submit"
          scale="standard"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Sending…" : "Send report"}
        </ShopCommerceButton>
        <Link href={orderHref} className="shop-inline-link shop-focus-ring">
          Back to your order
        </Link>
      </div>
    </form>
  );
}
