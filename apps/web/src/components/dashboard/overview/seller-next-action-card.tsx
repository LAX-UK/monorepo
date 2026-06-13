import type { SellerNextAction } from "@/lib/seller/resolve-seller-next-action";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

type Props = {
  action: SellerNextAction;
};

export function SellerNextActionCard({ action }: Props) {
  return (
    <Surface
      variant="section"
      className="flex flex-col gap-4 border-primary/20 bg-primary/5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Your next action"
    >
      <div className="min-w-0 space-y-1">
        <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary">
          Next action
        </p>
        <h2 className="font-headline text-lg text-on-surface">{action.title}</h2>
        <p className="font-body text-sm text-on-surface-variant">{action.description}</p>
      </div>
      <Button asChild className="w-fit shrink-0">
        <Link href={action.href}>
          {action.cta}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>
    </Surface>
  );
}
