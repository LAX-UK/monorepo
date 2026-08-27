"use client";

import { SendVerificationEmailButton } from "@/components/auth/send-verification-email-button";
import { ConditionReportRequestForm } from "@/components/sections/artwork/redesign/condition-report-request-form";
import type { ConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { Button } from "@auction/ui/components/button";
import type { ConditionReportRequestFormValues } from "@auction/validators";
import Link from "next/link";

export function LotConditionReportPublishedPanel({
  state,
}: {
  state: Extract<ConditionReportCardState, { kind: "published" }>;
}) {
  return (
    <>
      {state.summary ? <p className="text-on-surface-variant">{state.summary}</p> : null}
      <Button asChild size="sm" className="min-h-11 w-full">
        <a href={state.downloadUrl} target="_blank" rel="noreferrer">
          View condition report (PDF)
        </a>
      </Button>
    </>
  );
}

export function LotConditionReportNotSignedInPanel({
  state,
}: {
  state: Extract<ConditionReportCardState, { kind: "notSignedIn" }>;
}) {
  return (
    <>
      <p className="text-on-surface-variant">
        Request a formal condition report prepared by our specialists before you bid.
      </p>
      <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
        <Link href={`/login?next=${encodeURIComponent(state.loginNextPath)}`}>
          Sign in to request
        </Link>
      </Button>
    </>
  );
}

export function LotConditionReportEmailVerificationPanel({
  state,
}: {
  state: Extract<ConditionReportCardState, { kind: "emailVerificationRequired" }>;
}) {
  return (
    <>
      <p className="text-on-surface-variant">
        {state.email
          ? `Verify ${state.email} before requesting a condition report for this lot.`
          : "Verify your email address before requesting a condition report for this lot."}
      </p>
      <SendVerificationEmailButton
        email={state.email ?? ""}
        next={state.loginNextPath}
        label="Send verification email"
        className="min-h-11 w-full"
      />
    </>
  );
}

export function LotConditionReportKycRequiredPanel({
  state,
}: {
  state: Extract<ConditionReportCardState, { kind: "kycRequired" }>;
}) {
  return (
    <>
      <p className="text-on-surface-variant">
        {state.feedback ?? "Verify your identity to request a condition report for this lot."}
      </p>
      <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
        <Link href={contextualIdentityOnboardingHref(state.loginNextPath, "condition_report")}>
          Verify to continue bidding
        </Link>
      </Button>
    </>
  );
}

export function LotConditionReportRequestFormPanel({
  onSubmitRequest,
  submitting,
  apiErrorMessage,
}: {
  onSubmitRequest: (values: ConditionReportRequestFormValues) => Promise<boolean>;
  submitting: boolean;
  apiErrorMessage: string | null;
}) {
  return (
    <ConditionReportRequestForm
      onSubmitRequest={onSubmitRequest}
      submitting={submitting}
      apiErrorMessage={apiErrorMessage}
    />
  );
}

export function LotConditionReportStatePanel({
  state,
  onSubmitRequest,
  apiErrorMessage,
}: {
  state: ConditionReportCardState;
  onSubmitRequest: (values: ConditionReportRequestFormValues) => Promise<boolean>;
  apiErrorMessage: string | null;
}) {
  switch (state.kind) {
    case "published":
      return <LotConditionReportPublishedPanel state={state} />;
    case "notSignedIn":
      return <LotConditionReportNotSignedInPanel state={state} />;
    case "emailVerificationRequired":
      return <LotConditionReportEmailVerificationPanel state={state} />;
    case "kycRequired":
      return <LotConditionReportKycRequiredPanel state={state} />;
    case "submitError":
    case "canRequest":
    case "submitting":
      return (
        <LotConditionReportRequestFormPanel
          onSubmitRequest={onSubmitRequest}
          submitting={state.kind === "submitting"}
          apiErrorMessage={state.kind === "submitError" ? state.message : apiErrorMessage}
        />
      );
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
