import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = { params: Promise<{ id: string }> };

export default async function SaleRegistrationsPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Sale registrations"
        description={`Approve paddle requests for sale ${id.slice(0, 8)}… Assign paddles and capture onsite notes.`}
        className="border-0 pb-0"
      />
      <EmptyState
        title="sale_registration migration pending"
        description="Public intake + admin approval queues unlock once schema 3.1 lands."
        action={
          <Link
            href={`/admin/sales/${id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-outline-variant/30 px-4 py-2 font-label text-xs uppercase tracking-widest"
          >
            Back to sale
          </Link>
        }
      />
    </div>
  );
}
