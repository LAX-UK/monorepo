import { StatusBadge } from "@auction/ui/lax";

type Props = {
  owned: boolean;
  className?: string;
};

/** Shown on lot cards when the signed-in user is the lot seller: opaque, so it reads on any image. */
export function OwnerBadge({ owned, className }: Props) {
  if (!owned) return null;
  return (
    <StatusBadge tone="neutral" onImage {...(className ? { className } : {})}>
      Your listing
    </StatusBadge>
  );
}
