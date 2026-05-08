"use client";

import { Button } from "@/components/ui/button";
import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import type { LegalEntitySummary } from "@auction/types";
import { cn } from "@auction/ui";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

type Props = {
  acting: LegalEntitySummary;
  memberships: LegalEntitySummary[];
};

function subkindLabel(subkind: LegalEntitySummary["subkind"]): string {
  return subkind.replace(/_/g, " ");
}

export function LegalEntitySwitcher({ acting, memberships }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (memberships.length <= 1) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border bg-surface px-3 py-1.5 text-sm"
        data-testid="legal-entity-switcher"
        data-single
      >
        <span className="font-medium">{acting.displayName}</span>
        <span className="text-on-surface-variant text-xs">{subkindLabel(acting.subkind)}</span>
      </div>
    );
  }

  function handleSelect(id: string) {
    if (id === acting.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchActingLegalEntity(id);
      setOpen(false);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          aria-label="Switch acting legal entity"
          className="justify-between gap-2"
          data-testid="legal-entity-switcher"
          disabled={pending}
        >
          <span className="flex items-center gap-2">
            {pending && <Loader2 className="size-3 animate-spin" />}
            <span className="font-medium">{acting.displayName}</span>
            <span className="text-on-surface-variant text-xs">{subkindLabel(acting.subkind)}</span>
          </span>
          <ChevronsUpDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Command
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search organisations..." />
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
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        m.id === acting.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-medium">{m.displayName}</span>
                    <span className="ml-auto text-on-surface-variant text-xs">
                      {subkindLabel(m.subkind)}
                    </span>
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
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          m.id === acting.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{m.displayName}</span>
                        <span className="ml-2 text-on-surface-variant text-xs">
                          {subkindLabel(m.subkind)} · {m.role}
                          {m.isPrimaryAdmin ? " (primary)" : ""}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
