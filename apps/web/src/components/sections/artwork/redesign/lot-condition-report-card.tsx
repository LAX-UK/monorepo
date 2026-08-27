"use client";

import { LotConditionReportStatePanel } from "@/components/sections/artwork/redesign/lot-condition-report-state-panel";
import type { ConditionReportCardState } from "@/lib/condition-report/derive-condition-report-card-state";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { ConditionReportRequestFormValues } from "@auction/validators";
import { ChevronDown, FileSearch, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

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

function headerSummary(state: ConditionReportCardState): string {
  switch (state.kind) {
    case "published":
      return "Condition report available";
    case "notSignedIn":
      return "Sign in to request a report";
    case "emailVerificationRequired":
      return "Verify email to request";
    case "kycRequired":
      return "Verify identity to request";
    default:
      return "Request a specialist condition report";
  }
}

export function LotConditionReportCard({
  state,
  onSubmitRequest,
  onHide,
  onRestore,
  isDismissed,
}: {
  state: ConditionReportCardState;
  onSubmitRequest: (values: ConditionReportRequestFormValues) => Promise<boolean>;
  onHide: () => void;
  onRestore: () => void;
  isDismissed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (isDismissed) {
    return <LotConditionReportRestoreLink onRestore={onRestore} />;
  }

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
          <span className="min-w-0 flex-1">{headerSummary(state)}</span>
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
          <LotConditionReportStatePanel
            state={state}
            onSubmitRequest={onSubmitRequest}
            apiErrorMessage={state.kind === "submitError" ? state.message : null}
          />
        </div>
      ) : null}
    </CardShell>
  );
}
