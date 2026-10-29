"use client";

import { inviteMemberAction } from "@/lib/legal-entity/member-management.actions";
import { roleLabel } from "@/lib/organisations/legal-entity-labels";
import type { LegalEntityMemberRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  /** The roles this person may invite someone as (from the member change policy). */
  roleOptions: readonly LegalEntityMemberRole[];
};

const PREFERRED_ROLE: LegalEntityMemberRole = "consignor";

export function InviteMemberForm({ legalEntityId, roleOptions }: Props) {
  const defaultRole = roleOptions.includes(PREFERRED_ROLE)
    ? PREFERRED_ROLE
    : (roleOptions[0] ?? PREFERRED_ROLE);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LegalEntityMemberRole>(defaultRole);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setSent(false);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    startTransition(async () => {
      const res = await inviteMemberAction(legalEntityId, trimmed, role);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail("");
      setRole(defaultRole);
      setSent(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-surface p-4">
      <h3 className="text-sm font-semibold">Invite a teammate</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            required
            autoComplete="email"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "invite-email-error" : undefined}
          />
          {emailError ? (
            <p id="invite-email-error" className="text-sm text-destructive">
              {emailError}
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as LegalEntityMemberRole)}>
            <SelectTrigger id="invite-role" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending || !email.trim()}>
          {pending ? "Sending…" : "Invite"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {sent ? (
        <p className="rounded-md border border-success/30 bg-success-container/20 px-3 py-2 text-sm text-on-surface">
          Invitation sent. They will receive an email with instructions to join.
        </p>
      ) : null}
    </form>
  );
}
