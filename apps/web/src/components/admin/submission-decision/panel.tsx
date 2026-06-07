"use client";

import type { ArtistSearchHit } from "@/components/artists/artist-search";
import { CreateArtistDialog } from "@/components/artists/create-artist-dialog";
import { RhfAsyncCombobox } from "@/components/ui/rhf-async-combobox";
import { LabelCaps } from "@/components/ui/typography";
import { searchAdminArtistsAction } from "@/lib/actions/admin-artists-search";
import {
  adminAcceptSubmissionResultAction,
  adminConvertSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { trackStaffAccept, trackStaffConvert } from "@/lib/analytics/sell-funnel";
import { artistKindMeta, artistStatusLabel } from "@/lib/artists/kind-presenter";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { Can } from "@/lib/auth/capabilities";
import { applyActionFieldErrors } from "@/lib/forms/apply-action-field-errors";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
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
import { type ApproveSubmissionBody, rejectSubmissionBodySchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SubmissionQualityChecklist } from "./submission-quality-checklist";

const approveFormSchema = z.object({
  reviewNotes: z.string().max(5000),
  artistId: z.string().uuid().nullable().optional(),
});
type ApproveFormValues = z.infer<typeof approveFormSchema>;

const rejectFormSchema = rejectSubmissionBodySchema;
type RejectFormValues = z.infer<typeof rejectFormSchema>;

async function searchArtistHits(trimmed: string): Promise<ArtistSearchHit[]> {
  const result = await searchAdminArtistsAction(trimmed);
  if (!result.ok) throw new Error("search");
  return result.data ?? [];
}

async function resolveArtistHit(id: string): Promise<ArtistSearchHit | null> {
  const res = await fetch(`${apiBaseUrl()}/admin/artists/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("resolve");
  const body = (await res.json()) as { data: unknown };
  const o = body.data as Record<string, unknown>;
  const rawKind = o.kind;
  const kind =
    rawKind === "artist" || rawKind === "maker" || rawKind === "brand" || rawKind === "marque"
      ? rawKind
      : "artist";
  const rawStatus = o.status;
  const status =
    rawStatus === "pending" ||
    rawStatus === "approved" ||
    rawStatus === "rejected" ||
    rawStatus === "merged_into"
      ? rawStatus
      : "approved";
  return {
    id: String(o.id ?? id),
    displayName: String(o.displayName ?? ""),
    slug: String(o.slug ?? ""),
    kind,
    status,
    matchedAlias: null,
    matchType: "exact",
    score: 0,
  };
}

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
  submission: Pick<
    ItemSubmission,
    | "title"
    | "images"
    | "description"
    | "provenance"
    | "categoryId"
    | "categoryIds"
    | "convertedLotId"
  >;
  /** Display name to seed the inline-create dialog when the admin clicks
   * "Use submitter as artist". Typically the submitter's legal entity name. */
  submitterDisplayName?: string;
  /** User id behind the submitter's legal entity (createdByUserId). When
   * present, inline-creating an artist links the new profile to this user
   * via {@link CreateArtistDialog.ownerUserId}. */
  submitterUserId?: string;
};

export function AdminSubmissionDecisionPanel({
  submissionId,
  status,
  submission,
  submitterDisplayName,
  submitterUserId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createSeed, setCreateSeed] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const approveFormEl = useRef<HTMLFormElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);

  const isPanelShortcutsActive = useCallback(() => {
    const el = panelRootRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, []);

  const approveForm = useForm<ApproveFormValues>({
    resolver: zodResolver(approveFormSchema),
    defaultValues: { reviewNotes: "", artistId: null },
  });

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { rejectionReason: "", reviewNotes: "" },
  });

  const searchHits = useCallback(async (query: string) => searchArtistHits(query), []);
  const resolveHit = useCallback(async (id: string) => resolveArtistHit(id), []);

  useEffect(() => {
    if (status !== "under_review" && status !== "approved") return;
    const onKey = (e: KeyboardEvent) => {
      if (!isPanelShortcutsActive()) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const inTextField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el?.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        approveFormEl.current?.requestSubmit();
        return;
      }
      if (inTextField) return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        approveFormEl.current?.requestSubmit();
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        document.getElementById("rejectionReason")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, isPanelShortcutsActive]);

  return (
    <Can
      requirement={SUBMISSIONS_ACCESS}
      fallback={
        <p className="font-body text-sm text-on-surface-variant">
          You do not have permission to review submissions.
        </p>
      }
    >
      <div ref={panelRootRef} className="space-y-6">
        {(status === "under_review" || status === "approved") && (
          <SubmissionQualityChecklist submission={submission} />
        )}
        <p className="font-body text-xs text-on-surface-variant">
          Shortcuts when not typing in a field: <span className="font-mono">A</span>{" "}
          {status === "approved" ? "convert" : "accept"}, <span className="font-mono">R</span> focus
          rejection, <span className="font-mono">⌘ Enter</span> submit.
        </p>

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
                id={CATALOG_FORM_IDS.submissionApprove}
                ref={approveFormEl}
                className="space-y-4"
                onSubmit={approveForm.handleSubmit((values) => {
                  startTransition(() => {
                    void (async () => {
                      const body: ApproveSubmissionBody = {};
                      const trimmed = values.reviewNotes.trim();
                      if (trimmed) body.reviewNotes = trimmed;
                      const r = await adminAcceptSubmissionResultAction(submissionId, body);
                      if (r.ok) {
                        trackStaffAccept(submissionId);
                        notify.success("Accepted for cataloguing");
                        router.refresh();
                        return;
                      }
                      if (r.fieldErrors) {
                        applyActionFieldErrors(approveForm, r.fieldErrors);
                      }
                      notify.error(r.error);
                    })();
                  });
                })}
              >
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
                  Accept for cataloguing
                </Button>
              </form>
            </Form>

            <Form {...rejectForm}>
              <form
                id={CATALOG_FORM_IDS.submissionReject}
                className="space-y-4 border-t border-border-hairline pt-8"
                onSubmit={rejectForm.handleSubmit((values) => {
                  startTransition(() => {
                    void (async () => {
                      const r = await adminRejectSubmissionResultAction(submissionId, values);
                      if (r.ok) {
                        notify.success("Submission rejected");
                        router.refresh();
                        return;
                      }
                      if (r.fieldErrors) {
                        applyActionFieldErrors(rejectForm, r.fieldErrors);
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

        {status === "approved" ? (
          <Form {...approveForm}>
            <form
              id={CATALOG_FORM_IDS.submissionApprove}
              ref={approveFormEl}
              className="space-y-4"
              onSubmit={approveForm.handleSubmit((values) => {
                startTransition(() => {
                  void (async () => {
                    const body: ApproveSubmissionBody = {};
                    const trimmed = values.reviewNotes.trim();
                    if (trimmed) body.reviewNotes = trimmed;
                    if (values.artistId) body.artistId = values.artistId;
                    const r = await adminConvertSubmissionResultAction(submissionId, body);
                    if (r.ok) {
                      trackStaffConvert(submissionId);
                      const pct = r.data?.readinessPercent;
                      notify.success(
                        pct != null
                          ? `Draft lot created — ${pct}% catalogue ready`
                          : "Draft lot created",
                      );
                      if (r.data?.lotId) {
                        router.push(`/admin/lots/${r.data.lotId}`);
                        return;
                      }
                      router.refresh();
                      return;
                    }
                    if (r.fieldErrors) {
                      applyActionFieldErrors(approveForm, r.fieldErrors);
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreateSeed(submitterDisplayName);
                        setCreateOpen(true);
                      }}
                      disabled={pending}
                      className="inline-flex h-auto min-h-0 items-center rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1 font-label text-[11px] uppercase tracking-wide text-on-surface shadow-none transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Use submitter as artist
                    </Button>
                  ) : null}
                </div>
                <FormField
                  control={approveForm.control}
                  name="artistId"
                  render={({ field }) => (
                    <FormItem>
                      <RhfAsyncCombobox<ArtistSearchHit>
                        value={field.value ?? null}
                        onChange={(id) => {
                          field.onChange(id ?? null);
                          setCreateSeed(null);
                        }}
                        onBlur={field.onBlur}
                        disabled={pending}
                        searchHits={searchHits}
                        resolveHit={resolveHit}
                        renderHit={(hit) => (
                          <span className="text-left font-body text-sm text-on-surface">
                            <span className="font-medium">{hit.displayName}</span>
                            <span className="mt-0.5 block font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                              {artistKindMeta(hit.kind).badge} · /{hit.slug}
                            </span>
                          </span>
                        )}
                        renderSelected={(hit) => (
                          <div className="text-sm">
                            <p className="font-medium text-on-surface">{hit.displayName}</p>
                            <p className="mt-1 font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
                              {artistKindMeta(hit.kind).badge} ·{" "}
                              {artistStatusLabel(hit.status).label} · /{hit.slug}
                            </p>
                          </div>
                        )}
                        placeholder="Search by name, slug, alias…"
                        clearLabel="Clear artist"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
                Convert to draft lot
              </Button>
            </form>
          </Form>
        ) : null}

        {status === "converted" && submission.convertedLotId ? (
          <Button className="min-h-11 w-full sm:w-auto" asChild>
            <Link href={`/admin/lots/${submission.convertedLotId}`}>Open draft lot</Link>
          </Button>
        ) : null}

        <CreateArtistDialog
          open={createOpen}
          initialName={createSeed ?? ""}
          approveOnCreate
          {...(submitterUserId ? { ownerUserId: submitterUserId } : {})}
          onCreated={(a) => {
            setCreateOpen(false);
            setCreateSeed(null);
            approveForm.setValue("artistId", a.id, { shouldDirty: true });
          }}
          onCancel={() => {
            setCreateOpen(false);
            setCreateSeed(null);
          }}
        />

        {status === "rejected" || status === "withdrawn" ? (
          <p className="text-sm text-on-surface-variant">No further actions for this status.</p>
        ) : null}
      </div>
    </Can>
  );
}
