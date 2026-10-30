"use client";

import { staffIdentityStatus } from "@/lib/admin/staff-kit-status";
import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import { Field, PersonCell, StaffButton, TextInput, cn } from "@auction/staff-ui";

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

/** Finds the client to check in by name or email, and lists who matched. */
export function SaleroomCheckInSearch({
  query,
  onQueryChange,
  searching,
  searchError,
  candidates,
  selectedUserId,
  onSelectCandidate,
}: Props) {
  const tooShort = query.trim().length < 2;
  const hint = searching
    ? "Searching…"
    : tooShort
      ? "Type at least two characters of their name or email."
      : candidates.length === 0 && !searchError
        ? "No clients match. Check the spelling, or ask them to create an account first."
        : undefined;

  return (
    <>
      <Field label="Find a client" {...(hint ? { description: hint } : {})} error={searchError}>
        <TextInput
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Name or email"
          autoComplete="off"
        />
      </Field>

      {candidates.length > 0 ? (
        <ul
          aria-label="Search results"
          className="divide-y divide-staff-line-subtle overflow-hidden rounded-staff-lg border border-staff-line"
        >
          {candidates.map((candidate) => {
            const selected = candidate.userId === selectedUserId;
            const existingPaddle = candidate.eligibleEntities.find(
              (entity) => entity.existingRegistration?.paddleNumber != null,
            )?.existingRegistration?.paddleNumber;
            const identity = staffIdentityStatus(candidate.kycStatus).label;
            return (
              <li key={candidate.userId}>
                <StaffButton
                  variant="ghost"
                  aria-pressed={selected}
                  onClick={() => onSelectCandidate(candidate.userId)}
                  className={cn(
                    "h-auto w-full justify-between gap-3 rounded-none px-3 py-2.5 text-left font-normal",
                    selected && "bg-staff-selected",
                  )}
                >
                  <PersonCell
                    name={displayName(candidate)}
                    secondary={candidate.name ? candidate.email : null}
                  />
                  <span className="shrink-0 text-staff-xs text-staff-muted">
                    {identity}
                    {existingPaddle != null ? ` · Paddle ${existingPaddle}` : ""}
                  </span>
                </StaffButton>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
