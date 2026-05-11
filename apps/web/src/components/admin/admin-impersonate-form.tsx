"use client";

import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { useState, useTransition } from "react";
import { AdminLegalEntityPicker } from "./admin-legal-entity-picker";

function errorMessage(code: string): string {
  switch (code) {
    case "not_found":
      return "No legal entity exists for that selection.";
    case "not_impersonation":
      return "You are already a member of that entity — use the dashboard acting-context switcher instead.";
    case "bad_request":
      return "Choose a legal entity from the search results.";
    case "unauthorized":
      return "Your session is not accepted by the API (401). Sign out and sign in again, or check that the web app can reach the API with your cookies.";
    case "forbidden":
      return "The API refused this request (403). Impersonation is limited to users with the administrator role.";
    case "network":
      return "The browser could not complete the server request to the API (network or DNS).";
    case "missing_acting_cookie":
      return "The API responded but did not include an acting cookie payload.";
    default:
      return "Could not start impersonation. Try again.";
  }
}

function formatImpersonationError(result: {
  ok: false;
  error: string;
  message?: string;
}): string {
  const friendly = errorMessage(result.error);
  if (!result.message) return friendly;
  return `${friendly}\n\nAPI: ${result.message}`;
}

export function AdminImpersonateForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const id = selectedId ?? "";
        startTransition(async () => {
          const result = await startAdminImpersonationAfterLookup(id);
          if (!result.ok) {
            setError(formatImpersonationError(result));
          }
        });
      }}
    >
      <div aria-live="polite" className="min-h-0">
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Impersonation failed</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Legal entity</Label>
        <AdminLegalEntityPicker
          value={selectedId}
          displayLabel={selectedLabel}
          disabled={pending}
          onChange={(id, row) => {
            setSelectedId(id);
            setSelectedLabel(
              row ? `${row.displayName} · ${row.status.replaceAll("_", " ")}` : null,
            );
          }}
        />
        <p className="text-sm text-on-surface-variant">
          Search by name. A four-hour support session starts; owners and admins are emailed
          automatically.
        </p>
      </div>

      <Button
        type="submit"
        disabled={pending || !selectedId}
        className="min-h-11 w-full min-w-[12rem] px-6 py-3 sm:w-auto"
      >
        {pending ? "Starting…" : "Start impersonation"}
      </Button>
    </form>
  );
}
