"use client";

import type { CoverAlertsOutcome } from "@/lib/marketing-cover/cover-alerts-outcome";
import { marketingEmailError } from "@auction/marketing-ui";
import { Button, ErrorSummary, Field, Notice, TextInput } from "@auction/ui/lax";
import { type FormEvent, useState } from "react";

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
 * script, a missing or malformed address is caught first and explained beside the field and in the
 * error summary, instead of after a round trip.
 */
export function HomeAlertsVisitorForm({ action, outcome, message, consent }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const email = new FormData(event.currentTarget).get("email");
    const problem = marketingEmailError(typeof email === "string" ? email : "");
    setError(problem);
    if (!problem) return;
    event.preventDefault();
    setFailedSubmits((count) => count + 1);
  }

  const serverInvalid = outcome === "invalid" && !error;
  return (
    <form
      method="post"
      action={action}
      noValidate
      onSubmit={onSubmit}
      className="w-full md:max-w-[480px] md:justify-self-end"
    >
      <input type="hidden" name="source" value="web_home_alerts" />
      <ErrorSummary
        errors={error ? [{ fieldId: FIELD_ID, message: error }] : []}
        focusKey={failedSubmits}
        className="mb-3"
      />
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
