"use client";

import { Alert, AlertDescription } from "@auction/ui/components/alert";

type Props = {
  message?: string | null;
};

/** Root-level form error from RHF `form.setError("root", ...)`. */
export function FormRootErrorAlert({ message }: Props) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
