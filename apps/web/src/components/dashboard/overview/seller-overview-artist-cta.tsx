import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export function SellerOverviewArtistCta() {
  return (
    <Surface
      variant="section"
      padding="lg"
      className="flex flex-wrap items-center gap-4 border-dashed border-primary/25 bg-primary-container/5"
    >
      <Sparkles className="size-8 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
          Artist profile
        </p>
        <p className="mt-1 font-body text-sm text-on-surface-variant dark:text-on-surface-variant">
          Opt in to manage portrait, biography, and attribution requests routed through admin
          approval.
        </p>
      </div>
      <Button variant="secondaryOutline" asChild>
        <Link href="/dashboard/seller/artist">Artist profile (request changes)</Link>
      </Button>
    </Surface>
  );
}
