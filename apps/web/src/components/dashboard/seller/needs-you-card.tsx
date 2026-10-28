import type { NeedsYouKind, NeedsYouVm } from "@/lib/seller/selling-needs-you";
import { Button } from "@auction/ui/components/button";
import {
  CreditCard,
  FileText,
  Gavel,
  type LucideIcon,
  Pencil,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

const KIND_ICON: Record<NeedsYouKind, LucideIcon> = {
  agreement: FileText,
  identity: UserCheck,
  payouts: CreditCard,
  changes: Pencil,
  draft: Pencil,
  rejected: RotateCcw,
  unsold: Gavel,
};

/**
 * "Needs you" at the top of Selling: what the person has to do, one row each, with the first step
 * they can take as the primary button. Nothing shows when nothing is due.
 */
export function NeedsYouCard({ vm }: { vm: NeedsYouVm }) {
  return (
    <section
      aria-labelledby="needs-you-heading"
      className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest"
    >
      <div className="px-4 pt-5 pb-2 md:px-5">
        <h2 id="needs-you-heading" className="font-headline text-lg font-semibold text-on-surface">
          Needs you
        </h2>
        <p className="mt-1 font-body text-sm text-on-surface-variant">{vm.summary}</p>
      </div>
      <ul className="divide-y divide-outline-variant/50">
        {vm.items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3.5">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-container-high text-on-surface"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[0.9375rem] font-semibold text-on-surface">
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-body text-sm text-on-surface-variant">{item.detail}</p>
                </div>
              </div>
              {item.action ? (
                <Button
                  asChild
                  size="default"
                  variant={item.action.emphasis === "primary" ? "primary" : "secondaryOutline"}
                  className="ml-12.5 self-start sm:ml-0 sm:self-center"
                >
                  <Link href={item.action.href}>{item.action.label}</Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
