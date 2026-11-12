"use client";

import type { CoverAlertsOutcome } from "@/lib/marketing-cover/cover-alerts-outcome";
import { marketingEmailError } from "@auction/marketing-ui/marketing-email-error";
import { useMarketingFormErrors } from "@auction/marketing-ui/use-marketing-form-errors";
import { Button } from "@auction/ui/lax/button";
import { Field } from "@auction/ui/lax/field";
import { TextInput } from "@auction/ui/lax/input";
import { Notice } from "@auction/ui/lax/notice";
import type { FormEvent } from "react";

type Props = {
  action: string;
  /** What happened to a sign-up posted without script, to show above the field. */
  outcome: CoverAlertsOutcome | null;
  message: { tone: "success" | "danger"; title: string; body: string } | null;
  consent: string;
};

const FIELD_ID = "home-alerts-email";
const PROBLEM_ID = "home-alerts-problem";

/**
 * The visitor's sale-alerts form. It posts as a plain form, so it works without script; with
 * script, a missing or malformed address is caught first and explained under the field, instead of
 * after a round trip.
 */
export function HomeAlertsVisitorForm({ action, outcome, message, consent }: Props) {
  const errors = useMarketingFormErrors({ email: FIELD_ID });
  const error = errors.messages.email ?? null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const email = new FormData(event.currentTarget).get("email");
    const problem = marketingEmailError(typeof email === "string" ? email : "");
    errors.fail(problem ? { email: problem } : {});
    if (problem) event.preventDefault();
  }

  const serverInvalid = outcome === "invalid" && !error;
  return (
    <form
      method="post"
      action={action}
      noValidate
      onSubmit={onSubmit}
      className="w-full text-start md:w-[30rem]"
    >
      <input type="hidden" name="source" value="web_home_alerts" />
      {message && !error ? (
        <Notice tone={message.tone} title={message.title} alert id={PROBLEM_ID} className="mb-3">
          {message.body}
        </Notice>
      ) : null}
      <div className="flex flex-col gap-2 md:flex-row md:items-start">
        <Field
          label="Your email address"
          labelHidden
          id={FIELD_ID}
          error={error}
          announce={errors.announce}
          className="md:flex-1"
        >
          <TextInput
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="Your email address"
            size="md"
            invalid={Boolean(error) || serverInvalid}
            {...(serverInvalid ? { "aria-describedby": PROBLEM_ID } : {})}
            onChange={() => errors.clear("email")}
            boxClassName="max-md:h-lax-control-lg"
            className="max-md:text-base"
          />
        </Field>
        <Button type="submit" variant="primary" size="md" className="max-md:h-lax-control-lg">
          Get sale alerts
        </Button>
      </div>
      <p className="m-0 mt-2 font-body text-xs leading-4 text-on-surface-variant">
        {consent} We&apos;ll ask you to confirm by email first.
      </p>
    </form>
  );
}
