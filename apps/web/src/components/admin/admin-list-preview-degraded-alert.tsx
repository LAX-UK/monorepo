import { AdminListAlert } from "@/components/admin/admin-list-alert";
import Link from "next/link";

type Props = {
  entityLabel: string;
  clearHref: string;
};

export function AdminListPreviewDegradedAlert({ entityLabel, clearHref }: Props) {
  return (
    <AdminListAlert title="Preview unavailable">
      This {entityLabel} could not be loaded.{" "}
      <Link href={clearHref} className="font-medium underline underline-offset-2">
        Clear preview
      </Link>
    </AdminListAlert>
  );
}
