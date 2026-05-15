"use client";

import { type ArtistChipModel, ArtistPicker } from "@/components/admin/artist-picker";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminApproveSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { notify } from "@/lib/ui/notify";
import type { ArtistKind, ArtistProfile, ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Textarea } from "@auction/ui/components/textarea";
import { approveSubmissionBodySchema, rejectSubmissionBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const approveFormSchema = z.object({
  reviewNotes: z.string().max(5000),
  artistId: z.string().uuid().nullable().optional(),
});
type ApproveFormValues = z.infer<typeof approveFormSchema>;

const rejectFormSchema = rejectSubmissionBodySchema;
type RejectFormValues = z.infer<typeof rejectFormSchema>;

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
  /** Display name to seed the inline-create dialog when the admin clicks
   * "Use submitter as artist". Typically the submitter's legal entity name. */
  submitterDisplayName?: string;
  /** Pre-fetched canonical artists used to render the selected chip without an
   * extra round-trip. The picker still searches over the wire. */
  artists: ArtistProfile[];
};

export function AdminSubmissionDecisionPanel({
  submissionId,
  status,
  submitterDisplayName,
  artists,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createSeed, setCreateSeed] = useState<string | null>(null);

  const approveForm = useForm<ApproveFormValues>({
    resolver: zodResolver(approveFormSchema),
    defaultValues: { reviewNotes: "", artistId: null },
  });

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { rejectionReason: "", reviewNotes: "" },
  });

  function chipFromId(id: string | null): ArtistChipModel | null {
    if (!id) return null;
    const found = artists.find((a) => a.id === id);
    if (!found) return null;
    return {
      id: found.id,
      displayName: found.displayName,
      slug: found.slug,
      kind: (found.kind ?? "artist") as ArtistKind,
      status: found.status ?? "approved",
    };
  }

  return (
    <div className="space-y-8">
      {status === "submitted" ? (
        <Button
          type="button"
          className="min-h-11 w-full sm:w-auto"
          disabled={pending}
          onClick={() => {
            startTransition(() => {
              void (async () => {
                const r = await adminStartSubmissionReviewResultAction(submissionId);
                if (r.ok) {
                  notify.success("Review started");
                  router.refresh();
                  return;
                }
                notify.error(r.error);
              })();
            });
          }}
        >
          Start review
        </Button>
      ) : null}

      {status === "under_review" ? (
        <div className="space-y-8">
          <Form {...approveForm}>
            <form
              className="space-y-4"
              onSubmit={approveForm.handleSubmit((values) => {
                startTransition(() => {
                  void (async () => {
                    const body: z.infer<typeof approveSubmissionBodySchema> = {};
                    const trimmed = values.reviewNotes.trim();
                    if (trimmed) body.reviewNotes = trimmed;
                    if (values.artistId) body.artistId = values.artistId;
                    const r = await adminApproveSubmissionResultAction(submissionId, body);
                    if (r.ok) {
                      notify.success("Approved — draft lot created");
                      if (r.data?.lotId) {
                        router.push(`/admin/lots/${r.data.lotId}`);
                        return;
                      }
                      router.refresh();
                      return;
                    }
                    notify.error(r.error);
                  })();
                });
              })}
            >
              <div className="space-y-3 rounded-md border border-outline-variant/30 bg-surface-container-lowest/60 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <LabelCaps>Catalogue artist</LabelCaps>
                  {submitterDisplayName ? (
                    <button
                      type="button"
                      onClick={() => setCreateSeed(submitterDisplayName)}
                      disabled={pending}
                      className="inline-flex items-center rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1 font-label text-[11px] uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Use submitter as artist
                    </button>
                  ) : null}
                </div>
                <FormField
                  control={approveForm.control}
                  name="artistId"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ArtistPicker
                          value={field.value ?? null}
                          onChange={(id) => {
                            field.onChange(id ?? null);
                            setCreateSeed(null);
                          }}
                          selected={chipFromId(field.value ?? null)}
                          {...(createSeed ? { createInitialName: createSeed } : {})}
                          helpText="Required before publish but can be left blank to attach later. Inline-creating an artist here defaults to status=approved."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={approveForm.control}
                name="reviewNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 block">
                      <LabelCaps>Internal review notes (optional)</LabelCaps>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="reviewNotesApprove"
                        rows={3}
                        className="font-body text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
                Approve and create draft lot
              </Button>
            </form>
          </Form>

          <Form {...rejectForm}>
            <form
              className="space-y-4 border-t border-outline-variant/15 pt-8"
              onSubmit={rejectForm.handleSubmit((values) => {
                startTransition(() => {
                  void (async () => {
                    const r = await adminRejectSubmissionResultAction(submissionId, values);
                    if (r.ok) {
                      notify.success("Submission rejected");
                      router.refresh();
                      return;
                    }
                    notify.error(r.error);
                  })();
                });
              })}
            >
              <FormField
                control={rejectForm.control}
                name="rejectionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 block" htmlFor="rejectionReason">
                      <LabelCaps>Rejection reason (required)</LabelCaps>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="rejectionReason"
                        rows={3}
                        className="font-body text-sm"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rejectForm.control}
                name="reviewNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 block">
                      <LabelCaps>Additional notes (optional)</LabelCaps>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        id="reviewNotesReject"
                        rows={2}
                        className="font-body text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11 w-full sm:w-auto"
                disabled={pending}
              >
                Reject
              </Button>
            </form>
          </Form>
        </div>
      ) : null}

      {status !== "submitted" && status !== "under_review" ? (
        <p className="text-sm text-on-surface-variant">No further actions for this status.</p>
      ) : null}
    </div>
  );
}
