"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";
import {
  type SaleFormatExplainerContext,
  resolveSaleFormatExplainer,
  saleFormatExplainerAriaLabel,
} from "@/lib/sale-format-explainer";
import { saleFormatIcon, saleFormatIconToneClass } from "@/lib/sale-format-icon";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { HelpCircle } from "lucide-react";
import type * as React from "react";

type PanelProps = {
  context: SaleFormatExplainerContext;
  className?: string | undefined;
};

export function SaleFormatExplainerPanel({ context, className }: PanelProps) {
  const vm = resolveSaleFormatExplainer(context);
  const Icon = saleFormatIcon(vm.iconName);

  return (
    <div className={cn("space-y-3 text-left", className)}>
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            saleFormatIconToneClass(vm.mode),
          )}
        >
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-0.5">
          <h3 className="font-headline text-base font-semibold text-on-surface">{vm.title}</h3>
          <p className="font-body text-xs text-secondary">{vm.tagline}</p>
        </div>
      </div>

      <p className="font-body text-xs leading-relaxed text-on-surface-variant">{vm.description}</p>

      {vm.steps.length > 0 ? (
        <div className="space-y-1.5 border-t border-outline-variant/20 pt-2.5">
          <p className="font-label text-[10px] font-bold uppercase tracking-wider text-secondary">
            How to participate
          </p>
          <ul className="list-none space-y-1.5 pl-0">
            {vm.steps.map((step) => (
              <li
                key={step.title}
                className="flex items-start gap-1 font-body text-[11px] leading-normal text-on-surface-variant"
              >
                <span className="select-none font-medium text-secondary" aria-hidden>
                  •
                </span>
                <span>
                  <strong className="font-medium text-on-surface">{step.title}:</strong>{" "}
                  {step.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.footnotes.map((note) => (
        <p key={note} className="font-body text-[10px] leading-relaxed text-on-surface-variant/80">
          {note}
        </p>
      ))}
    </div>
  );
}

/** @deprecated Use `SaleFormatExplainerPanel`. */
export function SaleTypeExplainerContent({
  context,
  className,
}: {
  context: SaleFormatExplainerContext;
  className?: string;
}) {
  return <SaleFormatExplainerPanel context={context} className={className} />;
}

type PopoverProps = {
  children?: React.ReactNode;
  context: SaleFormatExplainerContext;
  align?: "start" | "center" | "end";
};

export function SaleTypeExplainerPopover({ children, context, align = "center" }: PopoverProps) {
  const hydrated = useHydrated();
  const ariaLabel = saleFormatExplainerAriaLabel(context.deliveryMode);

  if (!hydrated) {
    return (
      children ?? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-on-surface-variant/75 hover:text-on-surface"
          aria-label={ariaLabel}
        >
          <HelpCircle className="size-4" />
        </Button>
      )
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-on-surface-variant/75 hover:text-on-surface"
            aria-label={ariaLabel}
          >
            <HelpCircle className="size-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="z-50 w-[min(360px,calc(100vw-2rem))] p-4 shadow-xl">
        <SaleFormatExplainerPanel context={context} />
      </PopoverContent>
    </Popover>
  );
}
