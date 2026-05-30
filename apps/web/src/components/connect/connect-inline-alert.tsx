"use client";

import { type ConnectErrorKind, connectErrorMessage } from "@/lib/connect/connect-error-copy";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { normalizeApiErrorMessage } from "@auction/validators";

type Props = {
  kind: ConnectErrorKind;
  /** Raw API or hook error — used for generic/init_failed when provided. */
  detail?: string | null;
  title?: string;
};

export function ConnectInlineAlert({ kind, detail, title }: Props) {
  const message =
    kind === "generic" && detail
      ? normalizeApiErrorMessage(detail, connectErrorMessage("generic"))
      : connectErrorMessage(kind, detail);

  return (
    <Alert variant={kind === "polling_timed_out" ? "default" : "destructive"}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="font-body text-sm">{message}</AlertDescription>
    </Alert>
  );
}
