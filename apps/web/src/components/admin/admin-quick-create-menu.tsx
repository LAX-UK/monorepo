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

export function AdminQuickCreateMenu() {
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
          <DropdownMenuItem asChild>
            <Link href="/admin/lots/new">
              <Package className="mr-2 size-4 opacity-70" aria-hidden />
              New lot
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/sales/new">
              <ScrollText className="mr-2 size-4 opacity-70" aria-hidden />
              New sale
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/artists/new">
              <Brush className="mr-2 size-4 opacity-70" aria-hidden />
              New artist
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin/invitations">
              <UserPlus className="mr-2 size-4 opacity-70" aria-hidden />
              Invite user
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </HydrationDeferred>
  );
}
