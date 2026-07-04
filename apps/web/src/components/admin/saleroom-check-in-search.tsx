"use client";

import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  searching: boolean;
  searchError: string | null;
  candidates: AdminCheckInCandidate[];
  selectedUserId: string | null;
  onSelectCandidate: (userId: string) => void;
};

function displayName(candidate: AdminCheckInCandidate): string {
  return candidate.name ?? candidate.email;
}

export function SaleroomCheckInSearch({
  query,
  onQueryChange,
  searching,
  searchError,
  candidates,
  selectedUserId,
  onSelectCandidate,
}: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="check-in-search">Search client</Label>
        <Input
          id="check-in-search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Type email or name (min 2 characters)"
          className="font-body text-sm"
          autoComplete="off"
        />
        {query.trim().length < 2 ? (
          <p className="font-body text-xs text-on-surface-variant">
            Type email or name (min 2 characters)
          </p>
        ) : null}
        {searching ? <p className="font-body text-xs text-on-surface-variant">Searching…</p> : null}
        {searchError ? (
          <p className="font-body text-xs text-destructive" role="alert">
            {searchError}
          </p>
        ) : null}
      </div>

      {candidates.length > 0 ? (
        <ul className="space-y-2" aria-label="Search results">
          {candidates.map((c) => {
            const selected = c.userId === selectedUserId;
            const existingPaddle = c.eligibleEntities.find(
              (e) => e.existingRegistration?.paddleNumber != null,
            )?.existingRegistration?.paddleNumber;
            return (
              <li key={c.userId}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-pressed={selected}
                  className={`h-auto w-full justify-start rounded-md border px-3 py-2 text-left whitespace-normal ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border-hairline hover:bg-surface-container-low/60"
                  }`}
                  onClick={() => onSelectCandidate(c.userId)}
                >
                  <p className="font-medium">{displayName(c)}</p>
                  <p className="font-body text-xs text-on-surface-variant">{c.email}</p>
                  <p className="mt-1 font-body text-xs text-on-surface-variant">
                    KYC: {c.kycStatus}
                    {existingPaddle != null ? <> · Already paddle #{existingPaddle}</> : null}
                  </p>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
