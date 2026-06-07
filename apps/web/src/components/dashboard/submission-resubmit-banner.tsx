type Props = {
  rejectionReason: string | null;
  reviewNotes: string | null;
};

export function SubmissionResubmitBanner({ rejectionReason, reviewNotes }: Props) {
  return (
    <output className="block space-y-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
      <p className="font-headline text-sm text-on-surface">Starting a new submission</p>
      <p className="font-body text-sm text-on-surface-variant">
        We pre-filled your previous details. Update anything the specialist flagged before
        submitting again.
      </p>
      {rejectionReason ? (
        <p className="font-body text-sm text-on-surface">
          <span className="font-semibold">Previous reason: </span>
          {rejectionReason}
        </p>
      ) : null}
      {reviewNotes ? (
        <p className="font-body text-sm text-on-surface-variant">{reviewNotes}</p>
      ) : null}
    </output>
  );
}
