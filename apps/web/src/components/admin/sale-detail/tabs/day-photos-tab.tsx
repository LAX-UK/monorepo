"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { MediaImage } from "@/components/ui/media-image";
import { notify } from "@/lib/ui/notify";
import {
  EmptyState,
  Field,
  FileDropzone,
  FormActions,
  MediaGrid,
  Notice,
  Section,
  StaffButton,
  TextInput,
  UnsavedChangesGuard,
  UploadQueue,
} from "@auction/staff-ui";
import type { SaleDayMediaRef } from "@auction/types";
import { useRouter } from "next/navigation";
import { ACCEPT_ALL, type DayMediaItem } from "./day-photos/day-media-types";
import { useDayPhotosTab } from "./day-photos/use-day-photos-tab";

type Props = {
  saleId: string;
  saleStatus: string;
  initialDayImages: SaleDayMediaRef[];
  previewUrlByKey: Record<string, string>;
  canManage: boolean;
};

function label(item: DayMediaItem, index: number) {
  return `${item.mediaType === "video" ? "Video" : "Photo"} ${index + 1}`;
}

/**
 * Photos and short clips from the saleroom floor. They can be arranged before the sale ends and
 * are published to the sale page once it has ended; until then nothing here is saved.
 */
export function SaleDayPhotosTab({
  saleId,
  saleStatus,
  initialDayImages,
  previewUrlByKey,
  canManage,
}: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();
  const media = useDayPhotosTab({ saleId, saleStatus, initialDayImages, previewUrlByKey });
  const { items, isEnded, saving } = media;
  const editable = canManage && !saving;

  const remove = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (!isEnded) {
      media.setItems(items.filter((_, i) => i !== index));
      return;
    }
    confirm.ask({
      title: `Remove ${label(item, index).toLowerCase()} from the sale page?`,
      description: "It is taken off the public gallery straight away.",
      confirmLabel: "Remove from gallery",
      tone: "danger",
      run: () => media.removeAndSave(item.id),
      success: "Removed from the gallery",
      onSuccess: () => {},
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!isEnded ? (
        <Notice tone="info" title="Published once the sale ends">
          Media added now stays on this page only and is lost if you leave. Add it after the sale
          ends to publish it to the sale page.
        </Notice>
      ) : null}
      {media.saveError ? (
        <Notice tone="danger" alert title="The media was not saved">
          {media.saveError}
        </Notice>
      ) : null}
      <Section
        title="Auction day media"
        description="The first item leads the gallery on the sale page."
      >
        <div className="flex flex-col gap-4">
          {items.length === 0 && !canManage ? (
            <EmptyState
              headingLevel="h3"
              title="No auction day media yet"
              description="Photos and videos from the saleroom appear here after the sale."
            />
          ) : null}
          {items.length > 0 ? (
            <MediaGrid
              items={items}
              noun="item"
              disabled={!editable}
              renderPreview={(item, index) =>
                item.mediaType === "video" ? (
                  // biome-ignore lint/a11y/useMediaCaption: staff preview of an uploaded clip; captions are not authored here.
                  <video
                    src={item.previewUrl}
                    aria-label={item.caption || label(item, index)}
                    className="size-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <MediaImage
                    src={item.previewUrl}
                    alt={item.alt || label(item, index)}
                    label={label(item, index)}
                    imgClassName="size-full object-cover"
                    sizes="240px"
                  />
                )
              }
              renderDetails={(item, index) => (
                <div className="flex flex-col gap-2">
                  <Field label="Caption" optional disabled={!editable}>
                    <TextInput
                      size="sm"
                      aria-label={`Caption for ${label(item, index).toLowerCase()}`}
                      maxLength={280}
                      value={item.caption}
                      disabled={!editable}
                      onChange={(event) => media.update(item.id, { caption: event.target.value })}
                    />
                  </Field>
                  {item.mediaType === "image" ? (
                    <Field label="Alt text" optional disabled={!editable}>
                      <TextInput
                        size="sm"
                        aria-label={`Alt text for ${label(item, index).toLowerCase()}`}
                        maxLength={280}
                        value={item.alt}
                        disabled={!editable}
                        onChange={(event) => media.update(item.id, { alt: event.target.value })}
                      />
                    </Field>
                  ) : null}
                </div>
              )}
              onMove={(from, to) => {
                const next = [...items];
                const [moved] = next.splice(from, 1);
                if (!moved) return;
                next.splice(to, 0, moved);
                media.setItems(next);
              }}
              onRemove={remove}
            />
          ) : null}
          {media.queue.length > 0 ? (
            <UploadQueue
              items={media.queue}
              onRetry={media.retry}
              onDismiss={media.dismissUpload}
            />
          ) : null}
          {canManage ? (
            <FileDropzone
              label={items.length === 0 ? "Upload photos and videos" : "Add photos and videos"}
              accept={ACCEPT_ALL}
              multiple
              compact={items.length > 0}
              disabled={saving}
              hint="JPEG, PNG or WebP photos, MP4 or WebM clips, up to 200 MB each."
              onFiles={media.uploadFiles}
            />
          ) : null}
          {canManage && isEnded && media.dirty ? (
            <FormActions
              start={<span className="text-staff-sm text-staff-muted">Unsaved changes</span>}
            >
              <StaffButton
                type="button"
                variant="primary"
                loading={saving}
                {...(media.anyUploading
                  ? { disabledReason: "Wait for the uploads to finish" }
                  : {})}
                onClick={async () => {
                  if (await media.save()) {
                    notify.success("Auction day media saved");
                  }
                }}
              >
                Save and publish
              </StaffButton>
            </FormActions>
          ) : null}
        </div>
      </Section>
      <UnsavedChangesGuard
        dirty={canManage && media.dirty}
        label="the auction day media"
        navigate={router.push}
        interceptBack={false}
      />
      {confirm.dialog}
    </div>
  );
}
