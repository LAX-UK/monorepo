import type { SignUpInvitePreview } from "@/lib/auth/sign-up-types";
import { MailCheck } from "lucide-react";

type SignUpInviteBannerProps = {
  invitePreview?: SignUpInvitePreview;
  isInvite: boolean;
};

export function SignUpInviteBanner({ invitePreview, isInvite }: SignUpInviteBannerProps) {
  if (invitePreview) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary-container/15 p-4">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-body text-sm font-medium text-on-surface">
            You&apos;ve been invited to join London Art Exchange
          </p>
          <p className="font-body text-sm text-on-surface-variant">
            Joining as{" "}
            <span className="font-medium text-on-surface">{invitePreview.roleLabel}</span>. Finish
            creating your account below.
          </p>
        </div>
      </div>
    );
  }

  if (isInvite) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        You&apos;re signing up with an invitation. Use the email address the invitation was sent to.
      </p>
    );
  }

  return null;
}
