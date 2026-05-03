"use client";

import { Button } from "@/components/ui/button";
import { LabelCaps } from "@/components/ui/typography";
import {
  adminApproveSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import type { ItemSubmissionStatus } from "@auction/types";
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
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const approveFormSchema = z.object({
  reviewNotes: z.string().max(5000),
});
type ApproveFormValues = z.infer<typeof approveFormSchema>;

const rejectFormSchema = rejectSubmissionBodySchema;
type RejectFormValues = z.infer<typeof rejectFormSchema>;

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
};

export function AdminSubmissionDecisionPanel({ submissionId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const approveForm = useForm<ApproveFormValues>({
    resolver: zodResolver(approveFormSchema),
    defaultValues: { reviewNotes: "" },
  });

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { rejectionReason: "", reviewNotes: "" },
  });

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
                  toast.success("Review started");
                  router.refresh();
                  return;
                }
                toast.error(r.error);
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
                    const body = approveSubmissionBodySchema.safeParse({
                      reviewNotes: values.reviewNotes.trim() || undefined,
                    });
                    if (!body.success) {
                      toast.error("Check review notes");
                      return;
                    }
                    const r = await adminApproveSubmissionResultAction(submissionId, body.data);
                    if (r.ok) {
                      toast.success("Approved — draft lot created");
                      if (r.data?.lotId) {
                        router.push(`/admin/lots/${r.data.lotId}`);
                        return;
                      }
                      router.refresh();
                      return;
                    }
                    toast.error(r.error);
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
                      toast.success("Submission rejected");
                      router.refresh();
                      return;
                    }
                    toast.error(r.error);
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
