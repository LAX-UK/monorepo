"use client";

import { initials } from "@/components/organisations/initials";
import { PendingInvitationsBadge } from "@/components/organisations/invitation-card-list";
import {
  roleLabel,
  statusBadgeVariant,
  statusLabel,
  subkindLabel,
} from "@/components/organisations/labels";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import type { LegalEntitySummary } from "@auction/types";
import { cn } from "@auction/ui";
import { Avatar, AvatarFallback } from "@auction/ui/components/avatar";
import { Button } from "@auction/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Check, ChevronRight, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  acting: LegalEntitySummary;
  memberships: LegalEntitySummary[];
  /** Pending org invites for the signed-in user's email (badge on trigger). */
  pendingInvitesCount?: number;
};

const SWITCH_FAILURE_TITLES: Record<"not_a_member" | "unauthenticated" | "unknown", string> = {
  not_a_member: "Cannot switch context",
  unauthenticated: "Session expired",
  unknown: "Could not switch context",
};

const SWITCH_FAILURE_DESCRIPTIONS: Record<"not_a_member" | "unauthenticated" | "unknown", string> =
  {
    not_a_member: "You no longer have access to that organisation.",
    unauthenticated: "Sign in again to keep working.",
    unknown: "Please try again in a moment.",
  };

export function LegalEntitySwitcher({ acting, memberships, pendingInvitesCount = 0 }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSelect(id: string) {
    if (id === acting.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const r = await switchActingLegalEntity(id);
      setOpen(false);
      if (r.ok) {
        router.refresh();
        return;
      }
      notify.error(SWITCH_FAILURE_TITLES[r.error], {
        description: SWITCH_FAILURE_DESCRIPTIONS[r.error],
      });
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Switch acting legal entity"
          className="h-auto min-h-11 w-full max-w-[min(22rem,calc(100vw-2rem))] justify-between gap-2 py-2"
          data-testid="legal-entity-switcher"
          disabled={pending}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {pending && <Loader2 className="size-4 shrink-0 animate-spin" />}
            <Avatar size="sm" className="size-9 shrink-0">
              <AvatarFallback className="bg-primary-container font-semibold text-on-primary-container">
                {initials(acting.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium leading-tight">{acting.displayName}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge variant={statusBadgeVariant(acting.status)} size="sm">
                  {statusLabel(acting.status)}
                </StatusBadge>
                <span className="truncate text-on-surface-variant text-xs">
                  {subkindLabel(acting.subkind)}
                  {acting.kind === "organisation" ? ` · ${roleLabel(acting.role)}` : ""}
                </span>
              </span>
            </span>
            <PendingInvitationsBadge count={pendingInvitesCount} />
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-outline-variant/20 p-3">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
            Current context
          </p>
          <div className="mt-2 flex min-h-11 items-center gap-2">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary-container text-xs font-semibold text-on-primary-container">
                {initials(acting.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{acting.displayName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <StatusBadge variant={statusBadgeVariant(acting.status)} size="sm">
                  {statusLabel(acting.status)}
                </StatusBadge>
                {acting.kind === "organisation" ? (
                  <StatusBadge variant="neutral" size="sm">
                    {roleLabel(acting.role)}
                  </StatusBadge>
                ) : null}
              </div>
            </div>
            <Check className="size-4 shrink-0 text-primary" aria-hidden />
          </div>
        </div>
        <Command
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search workspaces…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Personal">
              {memberships
                .filter((m) => m.kind === "individual")
                .map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${m.displayName} ${m.subkind}`}
                    onSelect={() => handleSelect(m.id)}
                    className="min-h-11"
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        m.id === acting.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Avatar size="sm" className="mr-2">
                      <AvatarFallback className="bg-surface-container-high text-xs font-semibold">
                        {initials(m.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.displayName}</span>
                      <span className="text-on-surface-variant text-xs">
                        {subkindLabel(m.subkind)}
                      </span>
                    </span>
                    <StatusBadge
                      variant={statusBadgeVariant(m.status)}
                      size="sm"
                      className="shrink-0"
                    >
                      {statusLabel(m.status)}
                    </StatusBadge>
                  </CommandItem>
                ))}
            </CommandGroup>
            {memberships.some((m) => m.kind === "organisation") && (
              <CommandGroup heading="Organisations">
                {memberships
                  .filter((m) => m.kind === "organisation")
                  .map((m) => (
                    <CommandItem
                      key={m.id}
                      value={`${m.displayName} ${m.subkind}`}
                      onSelect={() => handleSelect(m.id)}
                      className="min-h-11"
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4 shrink-0",
                          m.id === acting.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <Avatar size="sm" className="mr-2">
                        <AvatarFallback className="bg-primary-container text-xs font-semibold text-on-primary-container">
                          {initials(m.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{m.displayName}</span>
                        <span className="text-on-surface-variant text-xs">
                          {subkindLabel(m.subkind)} · {roleLabel(m.role)}
                          {m.isPrimaryAdmin ? " · Primary" : ""}
                        </span>
                      </span>
                      <StatusBadge
                        variant={statusBadgeVariant(m.status)}
                        size="sm"
                        className="shrink-0"
                      >
                        {statusLabel(m.status)}
                      </StatusBadge>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="rounded-b-lg border-t border-outline-variant/20 bg-surface-container-lowest/50 p-1">
          {pendingInvitesCount > 0 ? (
            <Link
              href="/dashboard/invitations"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low/80"
            >
              <span className="flex items-center gap-2">
                Pending invitations
                <StatusBadge variant="warning" size="sm">
                  {pendingInvitesCount > 9 ? "9+" : pendingInvitesCount}
                </StatusBadge>
              </span>
              <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
            </Link>
          ) : null}
          <Link
            href="/dashboard/organisations"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low/80"
          >
            Manage organisations
            <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
          </Link>
          <Link
            href="/onboarding/organisation?fresh=1"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low/80"
          >
            <span className="flex items-center gap-2">
              <Plus className="size-4 text-primary" aria-hidden />
              Register organisation
            </span>
            <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
