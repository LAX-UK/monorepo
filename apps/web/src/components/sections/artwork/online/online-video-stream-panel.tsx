import { SaleStreamPreview } from "@/components/marketing/sale-stream-preview";
import { cn } from "@auction/ui";

type Props = {
  streamUrl: string;
  saleTitle: string;
  posterUrl?: string | null;
  className?: string;
};

/** Online lot bid panel: live stream tab using the same embed as onsite pages. */
export function OnlineVideoStreamPanel({ streamUrl, saleTitle, posterUrl, className }: Props) {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg", className)}>
      <SaleStreamPreview
        streamUrl={streamUrl}
        saleTitle={saleTitle}
        posterUrl={posterUrl ?? null}
      />
    </div>
  );
}
