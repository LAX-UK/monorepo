import type { SaleroomCaptionParts } from "@/lib/saleroom/saleroom-mobile-chrome";
import { cn } from "@auction/ui";

type Props = {
  caption: SaleroomCaptionParts;
  className?: string;
};

/** Renders saleroom on-block / paused headline + optional detail with shared typography. */
export function SaleroomSessionCaption({ caption, className }: Props) {
  return (
    <p className={cn("font-body text-sm text-on-surface", className)}>
      <span className="font-medium">{caption.headline}</span>
      {caption.detail ? <span className="text-on-surface-variant"> · {caption.detail}</span> : null}
    </p>
  );
}
