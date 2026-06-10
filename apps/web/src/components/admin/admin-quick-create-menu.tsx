"use client";

import { HydrationDeferred } from "@/components/layout/hydration-deferred";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Brush, Package, Plus, ScrollText, UserPlus } from "lucide-react";
import Link from "next/link";

export type QuickCreateItem = {
  id: string;
  href: string;
  label: string;
  iconName: "Package" | "ScrollText" | "Brush" | "UserPlus";
};

const ICONS = {
  Package,
  ScrollText,
  Brush,
  UserPlus,
} as const;

const triggerClassName = "min-h-9 gap-1.5 font-label text-xs";

function QuickCreateTrigger({ pending }: { pending?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={triggerClassName}
      aria-label="Quick create"
      {...(pending ? { disabled: true, "aria-busy": true as const } : {})}
    >
      <Plus className="size-4" aria-hidden />
      <span className="hidden sm:inline">Create</span>
    </Button>
  );
}

type Props = {
  items: readonly QuickCreateItem[];
};

export function AdminQuickCreateMenu({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <HydrationDeferred fallback={<QuickCreateTrigger pending />}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <QuickCreateTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
            Quick create
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => {
            const Icon = ICONS[item.iconName];
            return (
              <DropdownMenuItem key={item.id} asChild>
                <Link href={item.href}>
                  <Icon className="mr-2 size-4 opacity-70" aria-hidden />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </HydrationDeferred>
  );
}
