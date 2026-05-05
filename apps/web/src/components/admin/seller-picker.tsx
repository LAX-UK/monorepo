"use client";

import { Button } from "@/components/ui/button";
import type { AdminUserRow } from "@/lib/data/http/admin.server";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@auction/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  users: AdminUserRow[];
  value: string;
  onChange: (value: string) => void;
};

export function SellerPicker({ users, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const sellers = useMemo(
    () =>
      users
        .filter((user) => user.role === "client")
        .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email)),
    [users],
  );
  const selected = sellers.find((seller) => seller.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="w-full justify-start text-left">
          <span className={selected ? "" : "text-on-surface-variant"}>
            {selected ? `${selected.name} · ${selected.email}` : "Select seller"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(30rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Search sellers by name or email..." />
          <CommandList>
            <CommandEmpty>No client sellers found.</CommandEmpty>
            <CommandGroup>
              {sellers.map((seller) => {
                const checked = seller.id === value;
                return (
                  <CommandItem
                    key={seller.id}
                    value={`${seller.name} ${seller.email}`}
                    onSelect={() => {
                      onChange(seller.id);
                      setOpen(false);
                    }}
                    className="justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{seller.name}</span>
                      <span className="block truncate text-xs text-on-surface-variant">
                        {seller.email}
                      </span>
                    </span>
                    {checked ? <Check className="size-4 text-primary" aria-hidden /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
