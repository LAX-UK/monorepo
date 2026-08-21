"use client";

import { ConditionReportRequestForm } from "@/components/sections/artwork/redesign/condition-report-request-form";
import type { ConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { ConditionReportRequestFormValues } from "@auction/validators";
import { ChevronDown, FileSearch, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";

type Props = {
  state: ConditionReportCardState;
  onSubmitRequest: (values: ConditionReportRequestFormValues) => Promise<boolean>;
  submitting: boolean;
  apiErrorMessage: string | null;
  onHide: () => void;
  onRestore: () => void;
  isDismissed: boolean;
};

function CardShell({
  tone,
  children,
  className,
}: {
  tone: "primary" | "neutral";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    primary: "border-primary/35 bg-primary-container/15 ring-primary/25",
    neutral: "border-outline-variant/40 bg-surface-container-high/60 ring-outline-variant/20",
  };
  return (
    <div
      className={cn("rounded-lg border px-4 py-3 font-body text-sm ring-1", tones[tone], className)}
    >
      {children}
    </div>
  );
}

export function LotConditionReportRestoreLink({ onRestore }: { onRestore: () => void }) {
  return (
    <Button
      type="button"
      variant="link"
      size="link"
      onClick={onRestore}
      className="font-body text-xs font-medium text-link underline-offset-2 hover:underline"
    >
      Show condition report
    </Button>
  );
}

export function LotConditionReportCard({
  state,
  onSubmitRequest,
  submitting,
  apiErrorMessage,
  onHide,
  onRestore,
  isDismissed,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (isDismissed) {
    return <LotConditionReportRestoreLink onRestore={onRestore} />;
  }

  const showForm =
    state.kind === "canRequest" || state.kind === "submitting" || state.kind === "submitError";

  const headerSummary = (() => {
    switch (state.kind) {
      case "published":
        return "Condition report available";
      case "notSignedIn":
        return "Sign in to request a report";
      case "kycRequired":
        return "Verify identity to request";
      default:
        return "Request a specialist condition report";
    }
  })();

  const shellTone = state.kind === "published" ? "primary" : "neutral";

  return (
    <CardShell tone={shellTone} className="space-y-0 p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <FileSearch className="size-4 shrink-0 text-primary" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-body text-sm font-medium text-on-surface"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="min-w-0 flex-1">{headerSummary}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-on-surface-variant transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onHide}
          className="shrink-0 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          aria-label="Hide condition report for this lot"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {expanded ? (
        <div id={panelId} className="space-y-3 border-t border-outline-variant/30 px-4 pb-4 pt-3">
          <StateBody
            state={state}
            onSubmitRequest={onSubmitRequest}
            submitting={submitting}
            apiErrorMessage={apiErrorMessage}
            showForm={showForm}
          />
        </div>
      ) : null}
    </CardShell>
  );
}

function StateBody({
  state,
  onSubmitRequest,
  submitting,
  apiErrorMessage,
  showForm,
}: {
  state: ConditionReportCardState;
  onSubmitRequest: (values: ConditionReportRequestFormValues) => Promise<boolean>;
  submitting: boolean;
  apiErrorMessage: string | null;
  showForm: boolean;
}) {
  switch (state.kind) {
    case "published":
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

    case "notSignedIn":
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

    case "kycRequired":
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

    case "submitError":
    case "canRequest":
    case "submitting":
      if (!showForm) return null;
      return (
        <ConditionReportRequestForm
          onSubmitRequest={onSubmitRequest}
          submitting={submitting || state.kind === "submitting"}
          apiErrorMessage={apiErrorMessage}
        />
      );
  }
}
