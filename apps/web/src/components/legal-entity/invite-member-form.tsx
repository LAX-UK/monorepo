"use client";

import { inviteMemberAction } from "@/lib/legal-entity/member-management.actions";
import type { LegalEntityMemberRole } from "@auction/types";
import { legalEntityMemberRoles } from "@auction/types";
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
};

const DEFAULT_ROLE: LegalEntityMemberRole = "consignor";

export function InviteMemberForm({ legalEntityId }: Props) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LegalEntityMemberRole>(DEFAULT_ROLE);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setToken(null);
    startTransition(async () => {
      const res = await inviteMemberAction(legalEntityId, email.trim(), role);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail("");
      setRole(DEFAULT_ROLE);
      setToken(res.data.invitationToken);
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
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as LegalEntityMemberRole)}>
            <SelectTrigger id="invite-role" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {legalEntityMemberRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
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
      {token && (
        <p className="text-xs text-on-surface-variant">
          Invite created. Share this link with the invitee:{" "}
          <code className="rounded bg-surface-container px-1 py-0.5">/register?invite={token}</code>
        </p>
      )}
    </form>
  );
}
