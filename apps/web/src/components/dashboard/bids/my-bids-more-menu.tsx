"use client";

import { parseMyBidTab } from "@/lib/bid/my-bid-status";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Download, MoreHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";

/** The quiet extras of My bids, behind one "More" button: download the view in use as CSV. */
export function MyBidsMoreMenu() {
  const searchParams = useSearchParams();
  const tab = parseMyBidTab(searchParams?.get("tab"));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondaryOutline"
          size="default"
          aria-label="More actions"
          className="w-10 shrink-0 px-0"
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`/bids/export?tab=${tab}`} download>
            <Download aria-hidden className="size-4" />
            Export this view as CSV
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
