"use client";

import {
  type StaffAttentionItem,
  StaffNotificationBell,
} from "@/components/admin/staff-notification-bell";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Brush, Package, Plus, ScrollText, Upload, UserPlus } from "lucide-react";
import Link from "next/link";

type Props = {
  pendingSubmissionCount?: number;
  manualReviewCount?: number;
  attentionItems?: StaffAttentionItem[];
  showPlatformLinks?: boolean;
};

/** Global admin header: quick-create menu and attention badges. */
export function AdminShellHeaderActions({
  pendingSubmissionCount = 0,
  manualReviewCount = 0,
  attentionItems,
  showPlatformLinks = true,
}: Props) {
  const bellItems: StaffAttentionItem[] = attentionItems ?? [
    ...(pendingSubmissionCount > 0
      ? [
          {
            id: "submissions",
            href: "/admin/submissions",
            label: "Pending submissions",
            count: pendingSubmissionCount,
          } satisfies StaffAttentionItem,
        ]
      : []),
    ...(manualReviewCount > 0
      ? [
          {
            id: "manual-review",
            href: "/admin/payments?manualReview=1",
            label: "Payments — manual review",
            count: manualReviewCount,
          } satisfies StaffAttentionItem,
        ]
      : []),
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <StaffNotificationBell items={bellItems} />
      {showPlatformLinks && pendingSubmissionCount > 0 ? (
        <Button variant="ghost" size="sm" asChild className="relative min-h-9 gap-1.5 px-2">
          <Link
            href="/admin/submissions"
            aria-label={`${pendingSubmissionCount} pending submissions`}
          >
            <Upload className="size-4" aria-hidden />
            <span className="hidden font-label text-xs sm:inline">Submissions</span>
            <Badge className="h-5 min-w-5 rounded-full bg-lot-orange px-1 font-label text-[10px] text-white">
              {pendingSubmissionCount > 99 ? "99+" : pendingSubmissionCount}
            </Badge>
          </Link>
        </Button>
      ) : null}
      {showPlatformLinks ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 gap-1.5 font-label text-xs"
              aria-label="Quick create"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Create</span>
            </Button>
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
      ) : null}
    </div>
  );
}
