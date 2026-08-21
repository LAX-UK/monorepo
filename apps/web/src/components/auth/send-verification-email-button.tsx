"use client";

import { sendVerificationEmailForReturnPath } from "@/lib/auth/services/send-verification-email.service";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import type { ComponentProps } from "react";
import { useState } from "react";

type Props = {
  email: string;
  next: string;
  label?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
};

export function SendVerificationEmailButton({
  email,
  next,
  label = "Send verification email",
  className,
  variant = "outline",
  size = "sm",
}: Props) {
  const [sending, setSending] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={sending}
      onClick={() => {
        setSending(true);
        void sendVerificationEmailForReturnPath({ email, next })
          .then((result) => {
            if (!result.ok) {
              notify.error(result.message);
              return;
            }
            notify.success("Verification email sent");
          })
          .finally(() => setSending(false));
      }}
    >
      {sending ? "Sending…" : label}
    </Button>
  );
}
