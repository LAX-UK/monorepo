"use client";

import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { useState, useTransition } from "react";

export function AdminImpersonateForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const id = String(fd.get("legalEntityId") ?? "").trim();
          const result = await startAdminImpersonationAfterLookup(id);
          if (!result.ok) {
            setError(
              result.error === "not_found"
                ? "No legal entity exists with that UUID."
                : result.error === "not_impersonation"
                  ? "You are already a member of that entity — use the dashboard acting-context switcher instead."
                  : result.error === "bad_request"
                    ? "Enter a valid legal entity UUID."
                    : "Could not start impersonation. Try again.",
            );
            return;
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="legalEntityId">Legal entity ID (UUID)</Label>
        <Input
          id="legalEntityId"
          name="legalEntityId"
          type="text"
          placeholder="00000000-0000-4000-8000-000000000000"
          autoComplete="off"
          required
          disabled={pending}
          className="font-mono text-sm"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start impersonation"}
      </Button>
    </form>
  );
}
