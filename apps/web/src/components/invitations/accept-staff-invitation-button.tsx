"use client";

import { acceptStaffInvitationAction } from "@/lib/invitations/staff-invitation.actions";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AcceptStaffInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptStaffInvitationAction(token);
      if (result.ok) {
        router.replace(result.welcomePath);
        return;
      }
      setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        variant="cta"
        className="min-h-11 w-full"
        disabled={pending}
        onClick={accept}
      >
        {pending ? "Accepting…" : "Accept access"}
      </Button>
    </div>
  );
}
