"use client";

import { type SaleFilter, salesHref } from "@/lib/marketing/sales-filters";
import { cn } from "@auction/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

const chipClass = cn(
  "inline-flex h-10 items-center gap-1.5 font-headline text-sm font-medium uppercase leading-[21px] text-brand-900",
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  "dark:text-on-surface",
);

type Category = { id: string; name: string };

type Props = {
  filter: SaleFilter;
  categoryId: string | undefined;
  categories: Category[];
};

export function SalesCategoryFilter({ filter, categoryId, categories }: Props) {
  const label = categoryId
    ? (categories.find((c) => c.id === categoryId)?.name ?? "Category")
    : "Category";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(chipClass, "group")}
        type="button"
        aria-label="Filter by category"
      >
        <span>{label}</span>
        <ChevronDown className="size-5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuItem asChild>
          <Link href={salesHref(filter)} className="cursor-pointer">
            All categories
          </Link>
        </DropdownMenuItem>
        {categories.map((c) => (
          <DropdownMenuItem key={c.id} asChild>
            <Link href={salesHref(filter, c.id)} className="cursor-pointer">
              {c.name}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
