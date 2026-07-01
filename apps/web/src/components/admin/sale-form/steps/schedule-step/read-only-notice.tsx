type Props = {
  isDraft: boolean;
};

export function ReadOnlyNotice({ isDraft }: Props) {
  if (isDraft) return null;

  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 font-body text-sm text-on-surface-variant">
      <strong className="text-warning">Read-only fields:</strong> Schedule, delivery mode, and buyer
      premium are locked after publish. Title, description, cover images, and the live stream URL
      (on scheduled/active sales) are still editable.
    </div>
  );
}
