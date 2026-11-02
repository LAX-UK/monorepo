"use client";

import { sendVerificationEmailForReturnPath } from "@/lib/auth/services/send-verification-email.service";
import type {
  BidBlockerAction,
  BidBlockerPresentation,
  BidBlockerTone,
} from "@/lib/bid/bid-blocker-presentation";
import { notify } from "@/lib/ui/notify";
import { Button, ButtonLink, Notice, type NoticeTone } from "@auction/ui/lax";
import Link from "next/link";
import { type ReactNode, useState } from "react";

/** The kit has three tones; a neutral blocker reads as calm information. */
const NOTICE_TONE: Readonly<Record<BidBlockerTone, NoticeTone>> = {
  info: "info",
  neutral: "info",
  warning: "warning",
  danger: "danger",
};

function VerificationEmailAction({
  email,
  next,
  label,
}: { email: string; next: string; label: string }) {
  const [sending, setSending] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={sending}
      onClick={() => {
        setSending(true);
        void sendVerificationEmailForReturnPath({ email, next })
          .then((result) => {
            if (result.ok) notify.success("Verification email sent");
            else notify.error(result.message);
          })
          .finally(() => setSending(false));
      }}
    >
      {label}
    </Button>
  );
}

/** One row per kind of action a blocker can carry. */
const BLOCKER_ACTIONS: Readonly<{
  [K in BidBlockerAction["kind"]]: (action: Extract<BidBlockerAction, { kind: K }>) => ReactNode;
}> = {
  link: (action) => (
    <ButtonLink href={action.href} Link={Link} size="sm" variant="secondary">
      {action.label}
    </ButtonLink>
  ),
  email: (action) => (
    <VerificationEmailAction email={action.email} next={action.next} label={action.label} />
  ),
  status: () => null,
  // The recovery content below the notice is the action.
  panel: () => null,
};

function actionOf(action: BidBlockerAction | undefined): ReactNode {
  if (!action) return null;
  const build = BLOCKER_ACTIONS[action.kind] as (action: BidBlockerAction) => ReactNode;
  return build(action);
}

/**
 * Why this person can't bid on the lot right now (their account, their identity check, the
 * lot's own state), with the one way forward when there is one. The rules that decide it stay in
 * the bid policies; this draws their answer in the lot page's own notice.
 */
export function LotBidBlocker({ presentation }: { presentation: BidBlockerPresentation }) {
  return (
    <div className="grid gap-3" data-testid="bid-blocker">
      <Notice
        tone={NOTICE_TONE[presentation.tone]}
        title={presentation.title}
        actions={actionOf(presentation.action)}
      >
        {presentation.detail}
      </Notice>
      {presentation.content}
    </div>
  );
}
