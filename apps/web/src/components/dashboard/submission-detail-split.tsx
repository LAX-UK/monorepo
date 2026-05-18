import { SplitDetailLayout } from "@/components/dashboard/primitives/split-detail-layout";
import { MediaImage } from "@/components/ui/media-image";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import type { ItemSubmissionStatus } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import type { ReactNode } from "react";

type Props = {
  title: string;
  status: ItemSubmissionStatus;
  images: readonly (string | null)[];
  metaSlot: ReactNode;
  belowSplit?: ReactNode;
};

export function SubmissionDetailSplit({ title, status, images, metaSlot, belowSplit }: Props) {
  const urls = images.filter((src): src is string => Boolean(src));

  return (
    <SplitDetailLayout
      mediaSlot={
        urls.length > 0 ? (
          <div className="space-y-3">
            <Surface variant="section" padding="none" className="overflow-hidden">
              <MediaImage
                src={urls[0]}
                alt={`${title} primary`}
                label="Submission image"
                aspect={[4, 5]}
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            </Surface>
            {urls.length > 1 ? (
              <div className="grid grid-cols-4 gap-2">
                {urls.slice(1, 5).map((src, index) => (
                  <MediaImage
                    key={src}
                    src={src}
                    alt={`${title} ${index + 2}`}
                    label="Submission thumbnail"
                    aspect={[1, 1]}
                    sizes="80px"
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Surface variant="quiet" padding="md" className="text-sm text-on-surface-variant">
            No images attached to this submission.
          </Surface>
        )
      }
      metaSlot={
        <div className="space-y-4">
          <div>
            <SubmissionStatusBadge status={status} />
          </div>
          {metaSlot}
        </div>
      }
      secondarySlot={belowSplit}
    />
  );
}
