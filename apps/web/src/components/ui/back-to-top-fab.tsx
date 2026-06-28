"use client";

import { useScrollPastThreshold } from "@/hooks/use-scroll-past-threshold";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowUp } from "lucide-react";

type Props = {
  targetId: string;
  threshold?: number;
  className?: string;
};

export function BackToTopFab({ targetId, threshold = 400, className }: Props) {
  const visible = useScrollPastThreshold(threshold);
  if (!visible) return null;

  return (
    <Button
      type="button"
      variant="cta"
      size="icon"
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-40 size-11 rounded-full shadow-lg motion-reduce:transition-none",
        className,
      )}
      onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" })}
    >
      <ArrowUp className="size-5" aria-hidden />
    </Button>
  );
}
