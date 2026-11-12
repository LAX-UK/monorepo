"use client";

import { PAY_COPY } from "@/lib/pay/pay-copy";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax/button";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COPIED_MS = 2000;

/**
 * Copies one bank detail. The icon turns to a tick and the toast says what was copied, so the
 * result is seen and heard; if the browser refuses, the value is still on the page to select.
 */
export function PayCopyButton({ value, what }: { value: string; what: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={PAY_COPY.copyLabel(what)}
      icon={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            notify.success(PAY_COPY.copied(what));
            setCopied(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), COPIED_MS);
          })
          .catch(() => undefined);
      }}
    >
      {PAY_COPY.copy}
    </Button>
  );
}
