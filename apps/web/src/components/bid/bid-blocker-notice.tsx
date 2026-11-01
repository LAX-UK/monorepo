"use client";

import { SendVerificationEmailButton } from "@/components/auth/send-verification-email-button";
import { ContextualKycGateTracker } from "@/components/onboarding/buyer-onboarding-analytics";
import type {
  BidBlockerAction,
  BidBlockerPresentation,
  BidBlockerTone,
} from "@/lib/bid/bid-blocker-presentation";
import { ButtonLink, Notice, type NoticeTone, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";

/** The bid blocker tones on the kit notice: a neutral hold reads as information. */
const NOTICE_TONES: Record<BidBlockerTone, NoticeTone> = {
  info: "info",
  warning: "warning",
  danger: "danger",
  neutral: "info",
};

function BidBlockerActionControl({ action }: { action: BidBlockerAction }) {
  switch (action.kind) {
    case "link":
      return (
        <ButtonLink Link={Link} variant="primary" href={action.href}>
          {action.label}
        </ButtonLink>
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
      return <StatusBadge tone="neutral">{action.label}</StatusBadge>;
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
  const kycHref =
    presentation.action?.kind === "link" && presentation.action.href.includes("source=bid_gate")
      ? presentation.action.href
      : null;
  const action =
    presentation.action && presentation.action.kind !== "panel" ? (
      <BidBlockerActionControl action={presentation.action} />
    ) : null;

  return (
    <Notice
      alert
      tone={NOTICE_TONES[presentation.tone]}
      title={presentation.title}
      data-testid="bid-blocker"
      {...(className ? { className } : {})}
      {...(action ? { actions: action } : {})}
    >
      {kycHref ? (
        <ContextualKycGateTracker source="bid_gate" nextPath={kycGateNextPath(kycHref)} />
      ) : null}
      <div className="text-pretty">{presentation.detail}</div>
      {presentation.content ? <div className="mt-4">{presentation.content}</div> : null}
      {presentation.preview ? (
        <p className="mt-3 border-t border-lax-line pt-3 text-lax-12 text-lax-muted">
          {presentation.preview}
        </p>
      ) : null}
    </Notice>
  );
}
