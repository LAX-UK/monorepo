import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type MarketingCardMediaProps = {
  className?: string;
  "data-media-style"?: string | undefined;
  children: ReactNode;
};

export function MarketingCardMedia({
  className,
  children,
  "data-media-style": mediaStyle,
}: MarketingCardMediaProps) {
  return (
    <div
      data-media-style={mediaStyle}
      className={cn(
        // Its images zoom when the `lax-card` frame around it is hovered (kit hover-press.css).
        "lax-card-media relative overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
