"use client";

import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  getArtworkDetail,
  setArtworkVisibility,
} from "@/server/application/admin-artwork-actions.server";
import { editionRunFacts, publishBlockerMessages } from "@/server/domain/artwork-editor.vm";
import {
  CHANNEL_LABELS,
  SALE_STATE_LABELS,
  presentArtworkState,
} from "@/server/domain/artwork-list.vm";
import type { AdminArtworkDetail } from "@auction/shop-contracts";
import {
  DetailPanel,
  ErrorState,
  KeyValueList,
  MappedStatusBadge,
  Notice,
  PanelSection,
  Skeleton,
  StaffButton,
  StatGrid,
  formatGbp,
  formatStaffDateTime,
  toast,
} from "@auction/staff-ui";
import { Eye, EyeOff, PenLine } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type LoadState =
  | { status: "loading" }
  | { status: "ok"; detail: AdminArtworkDetail }
  | { status: "failed"; message: string };

function QuickViewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
          <div key={index} className="grid grid-cols-[148px_1fr] gap-4 py-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The artwork beside the list: image, facts, edition counts and what stops it going live, with
 * publish or unpublish one click away and the editor for everything else.
 */
export function ArtworkQuickView({
  artworkId,
  canWrite,
  onClose,
}: {
  artworkId: string | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [changing, setChanging] = useState(false);

  const load = useCallback((id: string) => {
    setState({ status: "loading" });
    getArtworkDetail(id)
      .then((result) =>
        setState(
          result.ok
            ? { status: "ok", detail: result.data }
            : { status: "failed", message: adminMutationErrorMessage(result) },
        ),
      )
      .catch(() => setState({ status: "failed", message: "Check your connection and try again." }));
  }, []);

  useEffect(() => {
    if (artworkId) load(artworkId);
  }, [artworkId, load]);

  const detail = state.status === "ok" ? state.detail : null;
  const live = detail?.state === "live" || detail?.state === "sold_out";
  const canPublish = detail?.state === "draft" && detail.publishBlockers.length === 0;

  async function toggle() {
    if (!detail) return;
    setChanging(true);
    const action = live ? "unpublish" : "publish";
    const result = await setArtworkVisibility({
      artworkId: detail.artworkId,
      action,
      idempotencyKey: crypto.randomUUID(),
    });
    setChanging(false);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    toast.success(live ? `Unpublished “${detail.title}”` : `Published “${detail.title}”`);
    load(detail.artworkId);
    router.refresh();
  }

  return (
    <DetailPanel
      open={artworkId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={detail?.title ?? "Artwork"}
      description={detail ? detail.artist.displayName : "Loading…"}
      status={
        detail ? <MappedStatusBadge status={detail.state} present={presentArtworkState} /> : null
      }
      footer={
        artworkId ? (
          <>
            {canWrite && detail && (live || canPublish) ? (
              <StaffButton
                variant="secondary"
                icon={live ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                loading={changing}
                onClick={() => void toggle()}
              >
                {live ? "Unpublish" : "Publish"}
              </StaffButton>
            ) : null}
            <StaffButton asChild variant="primary" icon={<PenLine aria-hidden />}>
              <Link href={`/artworks/${artworkId}`}>Edit artwork</Link>
            </StaffButton>
          </>
        ) : null
      }
    >
      {state.status === "loading" ? <QuickViewSkeleton /> : null}
      {state.status === "failed" ? (
        <ErrorState
          headingLevel="h3"
          title="This artwork did not load"
          description={state.message}
          action={
            <StaffButton size="sm" onClick={() => artworkId && load(artworkId)}>
              Try again
            </StaffButton>
          }
        />
      ) : null}
      {detail ? (
        <>
          <ArtworkThumbnail
            size="lg"
            url={detail.images[0]?.url ?? detail.importedImageUrl}
            className="rounded-staff-md"
          />
          {detail.state === "draft" && detail.publishBlockers.length > 0 ? (
            <Notice tone="warning" title="Not ready to publish" className="mt-4">
              {publishBlockerMessages(detail).join(" ")}
            </Notice>
          ) : null}
          <PanelSection title="Details">
            <KeyValueList
              items={[
                { label: "Artist", value: detail.artist.displayName },
                { label: "Year", value: detail.yearCreated ?? "—" },
                { label: "Medium", value: detail.medium ?? "—" },
                {
                  label: "Edition price",
                  value:
                    detail.printPricePence === null
                      ? detail.eligibleForEditionAllocation
                        ? "Not priced"
                        : "On enquiry"
                      : formatGbp(detail.printPricePence),
                  numeric: true,
                },
                { label: "Sale", value: SALE_STATE_LABELS[detail.saleState] },
                { label: "Channel", value: CHANNEL_LABELS[detail.salesChannel] },
                { label: "Updated", value: formatStaffDateTime(detail.updatedAt) },
              ]}
            />
          </PanelSection>
          {detail.editions.size > 0 ? (
            <PanelSection title={`Editions (${detail.editions.size})`}>
              <StatGrid
                label="Edition counts"
                className="md:grid-cols-2"
                items={editionRunFacts(detail.editions).slice(0, 4)}
              />
            </PanelSection>
          ) : null}
        </>
      ) : null}
    </DetailPanel>
  );
}
