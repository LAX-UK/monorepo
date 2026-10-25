import { Notice } from "@auction/staff-ui";

type Props = {
  isDraft: boolean;
};

export function ReadOnlyNotice({ isDraft }: Props) {
  if (isDraft) return null;
  return (
    <Notice tone="info" title="Some details are fixed once a sale is published">
      The schedule, format and buyer's premium cannot change. The title, description, cover images
      and live stream link still can.
    </Notice>
  );
}
