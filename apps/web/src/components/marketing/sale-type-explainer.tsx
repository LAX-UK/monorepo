"use client";

import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import { cn } from "@auction/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { HelpCircle, Laptop, MapPin } from "lucide-react";
import type * as React from "react";

type Props = {
  activeMode?: "online" | "onsite" | undefined;
  className?: string;
};

export function SaleTypeExplainerContent({ activeMode, className }: Props) {
  const onlinePres = getSaleTypePresentation("online");
  const onsitePres = getSaleTypePresentation("onsite");

  const sections = [
    { pres: onlinePres, icon: Laptop, isSelected: activeMode === "online" },
    { pres: onsitePres, icon: MapPin, isSelected: activeMode === "onsite" },
  ];

  return (
    <div className={cn("space-y-4 text-left", className)}>
      <h3 className="font-headline text-base font-semibold text-on-surface">
        Auction Formats Explained
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map(({ pres, icon: Icon, isSelected }) => (
          <div
            key={pres.key}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              isSelected
                ? "border-primary/45 bg-primary/5 dark:bg-primary/10"
                : "border-outline-variant/30 bg-surface-container-lowest dark:bg-surface-container-low",
            )}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  pres.key === "online"
                    ? "bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
                    : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
                )}
              >
                <Icon className="size-4" />
              </div>
              <h4 className="font-headline text-sm font-semibold text-on-surface">{pres.title}</h4>
            </div>
            <p className="mt-2 font-body text-xs text-on-surface-variant leading-relaxed">
              {pres.description}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-outline-variant/20 pt-2">
              <p className="font-label text-[10px] font-bold uppercase tracking-wider text-secondary">
                How to participate:
              </p>
              <ul className="space-y-1 pl-1 list-none">
                {pres.howToTakePart.map((step) => (
                  <li
                    key={`${pres.key}-${step.title}`}
                    className="font-body text-[11px] text-on-surface-variant leading-normal flex items-start gap-1"
                  >
                    <span className="text-secondary select-none font-medium">•</span>
                    <span>
                      <strong className="text-on-surface font-medium">{step.title}:</strong>{" "}
                      {step.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {pres.key === "onsite" ? (
              <p className="font-body text-[10px] text-on-surface-variant/70 leading-relaxed">
                Live stream availability varies by sale.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

type PopoverProps = {
  children?: React.ReactNode;
  activeMode?: "online" | "onsite";
  align?: "start" | "center" | "end";
};

export function SaleTypeExplainerPopover({ children, activeMode, align = "center" }: PopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="text-on-surface-variant/75 hover:text-on-surface transition-colors rounded-full focus-visible:ring-2 focus-visible:ring-primary outline-hidden"
            aria-label="Learn about auction formats"
          >
            <HelpCircle className="size-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(540px,calc(100vw-2rem))] p-4 shadow-xl z-50">
        <SaleTypeExplainerContent activeMode={activeMode} />
      </PopoverContent>
    </Popover>
  );
}
