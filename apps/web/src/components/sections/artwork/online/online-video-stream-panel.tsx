import { VideoPlaceholder } from "@/components/sections/artwork/onsite/video-placeholder";
import { cn } from "@auction/ui";

type Props = {
  className?: string;
};

/** Online mockup: Video Stream tab — placeholder until a stream URL exists. */
export function OnlineVideoStreamPanel({ className }: Props) {
  return (
    <div className={cn("w-full", className)}>
      <VideoPlaceholder className="rounded-lg" />
    </div>
  );
}
