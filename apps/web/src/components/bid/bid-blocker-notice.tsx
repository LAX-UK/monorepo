"use client";

import { SendVerificationEmailButton } from "@/components/auth/send-verification-email-button";
import { ContextualKycGateTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import type {
  BidBlockerAction,
  BidBlockerPresentation,
  BidBlockerTone,
} from "@/lib/bid/bid-blocker-presentation";
import { cn } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { AlertTriangle, CircleAlert, Clock3, Info, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

const TONE_CLASSES: Record<BidBlockerTone, string> = {
  info: "border-primary/30 bg-primary-container/10",
  warning: "border-lot-orange/35 bg-lot-orange/5",
  danger: "border-error/35 bg-error-container/10",
  neutral: "border-outline-variant/30 bg-surface-container-low",
};

const TONE_ICONS: Record<BidBlockerTone, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  danger: CircleAlert,
  neutral: Clock3,
};

function BidBlockerActionControl({ action }: { action: BidBlockerAction }) {
  switch (action.kind) {
    case "link":
      return (
        <Button asChild size="sm" className="min-h-11">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      );
    case "email":
      return (
        <SendVerificationEmailButton
          email={action.email}
          next={action.next}
          label={action.label}
          variant="default"
          className="min-h-11"
        />
      );
    case "status":
      return (
        <span className="inline-flex min-h-9 items-center rounded-full border border-outline-variant/40 bg-surface-container-low px-3 font-label text-xs font-semibold text-on-surface-variant">
          {action.label}
        </span>
      );
    case "panel":
      return null;
  }
}

function kycGateNextPath(href: string): string | null {
  try {
    return new URL(href, "https://lax.local").searchParams.get("next");
  } catch {
    return null;
  }
}

export function BidBlockerNotice({
  presentation,
  className,
}: {
  presentation: BidBlockerPresentation;
  className?: string;
}) {
  const Icon = TONE_ICONS[presentation.tone];
  const titleId = useId();
  const kycHref =
    presentation.action?.kind === "link" && presentation.action.href.includes("source=bid_gate")
      ? presentation.action.href
      : null;

  return (
    <Alert
      className={cn(
        "rounded-xl p-5 text-left shadow-sm ring-1 ring-outline-variant/10",
        TONE_CLASSES[presentation.tone],
        className,
      )}
      data-testid="bid-blocker"
      aria-labelledby={titleId}
    >
      {kycHref ? (
        <ContextualKycGateTracker source="bid_gate" nextPath={kycGateNextPath(kycHref)} />
      ) : null}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest/80"
          aria-hidden
        >
          <Icon className="size-4.5 text-on-surface-variant" />
        </span>
        <div className="min-w-0 flex-1">
          <AlertTitle id={titleId} className="font-headline text-base text-on-surface">
            {presentation.title}
          </AlertTitle>
          <AlertDescription className="mt-1 text-pretty font-body text-sm leading-relaxed text-on-surface-variant">
            {presentation.detail}
          </AlertDescription>
          {presentation.action && presentation.action.kind !== "panel" ? (
            <div className="mt-4">
              <BidBlockerActionControl action={presentation.action} />
            </div>
          ) : null}
          {presentation.content ? <div className="mt-4">{presentation.content}</div> : null}
          {presentation.preview ? (
            <p className="mt-4 border-t border-outline-variant/25 pt-3 font-body text-xs leading-relaxed text-on-surface-variant">
              {presentation.preview}
            </p>
          ) : null}
        </div>
      </div>
    </Alert>
  );
}
