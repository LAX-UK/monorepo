"use client";

import { Button } from "@auction/ui/components/button";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

export function ShareFiltersButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 font-label text-xs uppercase tracking-widest"
      onClick={() => {
        void navigator.clipboard.writeText(window.location.href);
        toast.success("Filter link copied");
      }}
    >
      <Link2 className="mr-2 size-4" aria-hidden />
      Share filters
    </Button>
  );
}
