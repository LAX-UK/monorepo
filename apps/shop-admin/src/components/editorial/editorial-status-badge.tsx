import type { EditorialPublicationStatus } from "@/lib/editorial-entity-forms";
import { StatusBadge } from "@auction/ui";

export function EditorialStatusBadge({ status }: { status: EditorialPublicationStatus }) {
  return (
    <StatusBadge variant={status === "published" ? "success" : "neutral"}>
      {status === "published" ? "Published" : "Draft"}
    </StatusBadge>
  );
}
